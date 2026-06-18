import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import type { PasswordEntry } from './keepassImporter.js';

/**
 * マスターパスワードによる暗号化ストア。
 *
 * - マスターパスワードから scrypt で 256bit 鍵を導出する。
 * - vault は AES-256-GCM で暗号化し、GCM の認証タグでパスワードの正否を検証する。
 * - 導出した鍵は main プロセスのメモリ上にのみ保持し、ファイルには一切書き出さない。
 * - 認証情報と vault は単一の独自形式ファイル（chocopass.cdb）にまとめて保存する。
 */

/** データファイル名（独自拡張子 .cdb = ChocoPass DB） */
const DB_FILENAME = 'chocopass.cdb';
const DB_FORMAT = 'ChocoPassDB';
const DB_VERSION = 1;

/**
 * 保存先ディレクトリの設定。
 * config.json は常に既定の userData に置き、その中の dataDir で
 * 実データ（chocopass.cdb）の保存先を指す。
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
 * 保存先ディレクトリを変更する。既存の chocopass.cdb を新しい場所へ移動し、
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
  const src = path.join(current, DB_FILENAME);
  const dest = path.join(resolvedNew, DB_FILENAME);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    fs.rmSync(src, { force: true });
  }
  const cfg = readConfig();
  cfg.dataDir = resolvedNew;
  fs.writeFileSync(getConfigPath(), JSON.stringify(cfg), 'utf-8');
  return resolvedNew;
}

/**
 * 現在開いている .cdb のパス。
 * null のときは既定の保存先（getDataDir()/chocopass.cdb）を使う。
 * ダブルクリックで特定のファイルを開いた場合はそのパスが入る。
 */
let currentDbPath: string | null = null;

/** データファイル（.cdb）の保存先 */
function getDbPath(): string {
  return currentDbPath ?? path.join(getDataDir(), DB_FILENAME);
}

/**
 * 開く .cdb ファイルを切り替える。
 * 別ファイルになるのでメモリ上の鍵は破棄し、ロック状態に戻す。
 */
export function openDbFile(filePath: string): void {
  currentDbPath = path.resolve(filePath);
  derivedKey = null;
}

/** 現在開いている .cdb のフルパス */
export function getCurrentDbPath(): string {
  return getDbPath();
}

interface EncBlob {
  iv: string;
  tag: string;
  data: string;
}

/**
 * 単一データファイルの構造。
 * - salt / verifier: マスターパスワードの検証用
 * - vault: 暗号化されたパスワードエントリ本体（未保存時は undefined）
 */
interface DbFile {
  format: string;
  version: number;
  salt: string;
  /** 既知の定数を暗号化したもの。復号できればパスワード正解 */
  verifier: EncBlob;
  vault?: EncBlob;
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

function readDb(): DbFile | null {
  const p = getDbPath();
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as DbFile;
}

function writeDb(db: DbFile): void {
  fs.writeFileSync(getDbPath(), JSON.stringify(db), 'utf-8');
}

/** マスターパスワードが設定済みか（chocopass.cdb が存在するか） */
export function hasMasterPassword(): boolean {
  return fs.existsSync(getDbPath());
}

/** 現在ロック解除済みか */
export function isUnlocked(): boolean {
  return derivedKey !== null;
}

/** ロックする（メモリ上の鍵を破棄） */
export function lock(): void {
  derivedKey = null;
}

/**
 * マスターパスワードを新規設定する。空の vault で初期化し、内容（空配列）を返す。
 */
export function setupMaster(password: string): PasswordEntry[] {
  const salt = crypto.randomBytes(16);
  const key = deriveKey(password, salt);

  const db: DbFile = {
    format: DB_FORMAT,
    version: DB_VERSION,
    salt: salt.toString('base64'),
    verifier: encrypt(key, VERIFIER_PLAINTEXT),
  };
  writeDb(db);

  derivedKey = key;

  const entries: PasswordEntry[] = [];
  saveVaultInternal(entries);
  return entries;
}

/**
 * マスターパスワードでロック解除する。
 * 成功時は鍵を保持し vault の内容を返す。失敗時は null を返す。
 */
export function unlock(password: string): PasswordEntry[] | null {
  try {
    const db = readDb();
    if (!db) return null;
    const salt = Buffer.from(db.salt, 'base64');
    const key = deriveKey(password, salt);
    // ベリファイアを復号できれば正解（失敗すると例外）
    if (decrypt(key, db.verifier) !== VERIFIER_PLAINTEXT) {
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
    const db = readDb();
    if (!db) return false;
    const oldKey = deriveKey(oldPassword, Buffer.from(db.salt, 'base64'));
    if (decrypt(oldKey, db.verifier) !== VERIFIER_PLAINTEXT) {
      return false;
    }
    // 現在の vault を旧鍵で復号してから新鍵で再暗号化
    const entries = loadVaultWithKey(oldKey);

    const newSalt = crypto.randomBytes(16);
    const newKey = deriveKey(newPassword, newSalt);
    db.salt = newSalt.toString('base64');
    db.verifier = encrypt(newKey, VERIFIER_PLAINTEXT);
    db.vault = encrypt(newKey, JSON.stringify(entries));
    writeDb(db);
    derivedKey = newKey;
    return true;
  } catch (error) {
    console.error('Failed to change master password:', error);
    return false;
  }
}

function loadVaultWithKey(key: Buffer): PasswordEntry[] {
  const db = readDb();
  if (!db || !db.vault) return [];
  return JSON.parse(decrypt(key, db.vault)) as PasswordEntry[];
}

function saveVaultInternal(entries: PasswordEntry[]): void {
  if (!derivedKey) {
    throw new Error('Vault is locked');
  }
  const db = readDb();
  if (!db) {
    throw new Error('Database not initialized');
  }
  db.vault = encrypt(derivedKey, JSON.stringify(entries));
  writeDb(db);
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
