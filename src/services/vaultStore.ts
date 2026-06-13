import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app, safeStorage } from 'electron';
import type { PasswordEntry } from './keepassImporter';

/**
 * マスターパスワードによる暗号化ストア。
 *
 * - マスターパスワードから scrypt で 256bit 鍵を導出する。
 * - vault は AES-256-GCM で暗号化し、GCM の認証タグでパスワードの正否を検証する。
 * - 導出した鍵は main プロセスのメモリ上にのみ保持し、ファイルには一切書き出さない。
 */

/**
 * 保存先ディレクトリの設定。
 * config.json は常に既定の userData に置き、その中の dataDir で
 * 実データ（auth.json / vault.enc）の保存先を指す。
 */
function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

function readConfig(): { dataDir?: string } {
  try {
    if (fs.existsSync(getConfigPath())) {
      return JSON.parse(fs.readFileSync(getConfigPath(), 'utf-8')) as { dataDir?: string };
    }
  } catch (error) {
    console.error('Failed to read config:', error);
  }
  return {};
}

/** 実データの保存先ディレクトリ（未設定／存在しなければ既定の userData） */
export function getDataDir(): string {
  const cfg = readConfig();
  if (cfg.dataDir && fs.existsSync(cfg.dataDir)) {
    return cfg.dataDir;
  }
  return app.getPath('userData');
}

/**
 * 保存先ディレクトリを変更する。既存の auth.json / vault.enc を新しい場所へ移動し、
 * 選択を config.json に記録する。新しいパスを返す。
 */
export function setDataDir(newDir: string): string {
  const current = getDataDir();
  const resolvedNew = path.resolve(newDir);
  if (path.resolve(current) === resolvedNew) {
    return resolvedNew;
  }
  if (!fs.existsSync(resolvedNew)) {
    fs.mkdirSync(resolvedNew, { recursive: true });
  }
  for (const name of ['auth.json', 'vault.enc']) {
    const src = path.join(current, name);
    const dest = path.join(resolvedNew, name);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      fs.rmSync(src, { force: true });
    }
  }
  const cfg = readConfig();
  cfg.dataDir = resolvedNew;
  fs.writeFileSync(getConfigPath(), JSON.stringify(cfg), 'utf-8');
  return resolvedNew;
}

/** 認証情報（ソルト + ベリファイア）の保存先 */
function getAuthPath(): string {
  return path.join(getDataDir(), 'auth.json');
}

/** マスターパスワードで暗号化した vault の保存先 */
function getVaultPath(): string {
  return path.join(getDataDir(), 'vault.enc');
}

// --- 旧形式（safeStorage / 平文）の移行用パス ---
function getLegacyVaultPath(): string {
  return path.join(app.getPath('userData'), 'vault.dat');
}
function getLegacyPlainPath(): string {
  return path.join(app.getPath('userData'), 'vault.json');
}

interface EncBlob {
  iv: string;
  tag: string;
  data: string;
}

interface AuthFile {
  salt: string;
  /** 既知の定数を暗号化したもの。復号できればパスワード正解 */
  verifier: EncBlob;
}

/** メモリ上にのみ保持する導出鍵（ロック中は null） */
let derivedKey: Buffer | null = null;

const VERIFIER_PLAINTEXT = 'chocopass-verifier-v1';
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.scryptSync(password, salt, 32, SCRYPT_PARAMS);
}

function encrypt(key: Buffer, plaintext: string): EncBlob {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: enc.toString('base64'),
  };
}

function decrypt(key: Buffer, blob: EncBlob): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(blob.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(blob.data, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

/** マスターパスワードが設定済みか（auth.json が存在するか） */
export function hasMasterPassword(): boolean {
  return fs.existsSync(getAuthPath());
}

/** 現在ロック解除済みか */
export function isUnlocked(): boolean {
  return derivedKey !== null;
}

/** ロックする（メモリ上の鍵を破棄） */
export function lock(): void {
  derivedKey = null;
}

/** 旧形式（safeStorage / 平文）の vault を読み込む。移行用 */
function readLegacyVault(): PasswordEntry[] | null {
  const legacy = getLegacyVaultPath();
  const plain = getLegacyPlainPath();
  try {
    if (fs.existsSync(legacy) && safeStorage.isEncryptionAvailable()) {
      const json = safeStorage.decryptString(fs.readFileSync(legacy));
      return JSON.parse(json) as PasswordEntry[];
    }
    if (fs.existsSync(plain)) {
      return JSON.parse(fs.readFileSync(plain, 'utf-8')) as PasswordEntry[];
    }
  } catch (error) {
    console.error('Failed to read legacy vault:', error);
  }
  return null;
}

function deleteLegacyVault(): void {
  fs.rmSync(getLegacyVaultPath(), { force: true });
  fs.rmSync(getLegacyPlainPath(), { force: true });
}

/**
 * マスターパスワードを新規設定する。
 * 旧形式の vault があれば移行し、その内容を返す（無ければ空配列）。
 */
export function setupMaster(password: string): PasswordEntry[] {
  const salt = crypto.randomBytes(16);
  const key = deriveKey(password, salt);

  const auth: AuthFile = {
    salt: salt.toString('base64'),
    verifier: encrypt(key, VERIFIER_PLAINTEXT),
  };
  fs.writeFileSync(getAuthPath(), JSON.stringify(auth), 'utf-8');

  derivedKey = key;

  // 旧データがあれば移行
  const legacy = readLegacyVault();
  const entries = legacy ?? [];
  saveVaultInternal(entries);
  if (legacy) {
    deleteLegacyVault();
  }
  return entries;
}

/**
 * マスターパスワードでロック解除する。
 * 成功時は鍵を保持し vault の内容を返す。失敗時は null を返す。
 */
export function unlock(password: string): PasswordEntry[] | null {
  try {
    const auth = JSON.parse(fs.readFileSync(getAuthPath(), 'utf-8')) as AuthFile;
    const salt = Buffer.from(auth.salt, 'base64');
    const key = deriveKey(password, salt);
    // ベリファイアを復号できれば正解（失敗すると例外）
    if (decrypt(key, auth.verifier) !== VERIFIER_PLAINTEXT) {
      return null;
    }
    derivedKey = key;
    return loadVault();
  } catch (error) {
    // 認証タグ不一致＝パスワード誤り
    return null;
  }
}

/** マスターパスワードを変更する。旧パスワードの検証に成功したら true */
export function changeMaster(oldPassword: string, newPassword: string): boolean {
  try {
    const auth = JSON.parse(fs.readFileSync(getAuthPath(), 'utf-8')) as AuthFile;
    const oldKey = deriveKey(oldPassword, Buffer.from(auth.salt, 'base64'));
    if (decrypt(oldKey, auth.verifier) !== VERIFIER_PLAINTEXT) {
      return false;
    }
    // 現在の vault を旧鍵で復号してから新鍵で再暗号化
    const entries = loadVaultWithKey(oldKey);

    const newSalt = crypto.randomBytes(16);
    const newKey = deriveKey(newPassword, newSalt);
    const newAuth: AuthFile = {
      salt: newSalt.toString('base64'),
      verifier: encrypt(newKey, VERIFIER_PLAINTEXT),
    };
    fs.writeFileSync(getAuthPath(), JSON.stringify(newAuth), 'utf-8');
    derivedKey = newKey;
    saveVaultInternal(entries);
    return true;
  } catch (error) {
    console.error('Failed to change master password:', error);
    return false;
  }
}

function loadVaultWithKey(key: Buffer): PasswordEntry[] {
  const vaultPath = getVaultPath();
  if (!fs.existsSync(vaultPath)) return [];
  const blob = JSON.parse(fs.readFileSync(vaultPath, 'utf-8')) as EncBlob;
  return JSON.parse(decrypt(key, blob)) as PasswordEntry[];
}

function saveVaultInternal(entries: PasswordEntry[]): void {
  if (!derivedKey) {
    throw new Error('Vault is locked');
  }
  const blob = encrypt(derivedKey, JSON.stringify(entries));
  fs.writeFileSync(getVaultPath(), JSON.stringify(blob), 'utf-8');
}

/** vault を保存する（ロック解除済みであること） */
export function saveVault(entries: PasswordEntry[]): void {
  if (!derivedKey) return;
  saveVaultInternal(entries);
}

/** vault を読み込む（ロック解除済みであること）。ロック中は空配列 */
export function loadVault(): PasswordEntry[] {
  if (!derivedKey) return [];
  try {
    return loadVaultWithKey(derivedKey);
  } catch (error) {
    console.error('Failed to load vault:', error);
    return [];
  }
}
