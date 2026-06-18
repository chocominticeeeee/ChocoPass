import React, { useEffect, useState } from 'react';
import { Moon, Sun, KeyRound, Check, AlertCircle, FolderOpen, Trash2 } from 'lucide-react';
import type { Theme } from '../theme';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

interface SettingsModalProps {
  theme: Theme;
  onChangeTheme: (theme: Theme) => void;
  onClose: () => void;
  /** 登録件数（全削除ボタンの活性判定用） */
  passwordCount: number;
  /** すべてのパスワードを削除 */
  onDeleteAll: () => void;
  /** マスターパスワードが設定済みか（未設定なら変更欄を隠す） */
  hasMaster: boolean;
}

export function SettingsModal({
  theme,
  onChangeTheme,
  onClose,
  passwordCount,
  onDeleteAll,
  hasMaster,
}: SettingsModalProps) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState(false);
  const [busy, setBusy] = useState(false);
  // データ保存先
  const [dataDir, setDataDir] = useState<string>('');
  const [dirBusy, setDirBusy] = useState(false);

  useEffect(() => {
    window.electron?.ipc.invoke('get-data-dir').then((p: string) => setDataDir(p ?? ''));
  }, []);

  const changeDataDir = async () => {
    setDirBusy(true);
    try {
      const res = await window.electron?.ipc.invoke('change-data-dir');
      if (res?.ok && res.path) {
        setDataDir(res.path);
      }
    } finally {
      setDirBusy(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwDone(false);

    if (!oldPw || !newPw) {
      setPwError('すべての項目を入力してください');
      return;
    }
    if (newPw.length < 8) {
      setPwError('新しいパスワードは8文字以上にしてください');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('確認用パスワードが一致しません');
      return;
    }

    setBusy(true);
    try {
      const res = await window.electron?.ipc.invoke('change-master', {
        oldPassword: oldPw,
        newPassword: newPw,
      });
      if (res?.ok) {
        setPwDone(true);
        setOldPw('');
        setNewPw('');
        setConfirmPw('');
      } else {
        setPwError('現在のマスターパスワードが正しくありません');
      }
    } catch {
      setPwError('変更に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-7 overflow-y-auto px-6 py-6">
          {/* テーマ切り替え */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              外観
            </h3>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-200">テーマ</p>
                <p className="text-xs text-slate-500">ダーク / ライトを切り替えます</p>
              </div>
              <ToggleGroup
                type="single"
                value={theme}
                onValueChange={(value) => {
                  // 同じ項目を再クリックすると空文字になるため無視する
                  if (value === 'dark' || value === 'light') onChangeTheme(value);
                }}
              >
                <ToggleGroupItem value="dark">
                  <Moon className="h-4 w-4" />
                  ダーク
                </ToggleGroupItem>
                <ToggleGroupItem value="light">
                  <Sun className="h-4 w-4" />
                  ライト
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </section>

          {/* データ保存先 */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <FolderOpen className="h-3.5 w-3.5" />
              データの保存先
            </h3>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="mb-1 text-xs text-slate-500">現在の保存先</p>
              <p className="mb-3 break-all font-mono text-xs text-slate-300">
                {dataDir || '読み込み中...'}
              </p>
              <Button
                onClick={changeDataDir}
                disabled={dirBusy}
                variant="outline"
                className="w-full border-cyan-400/30 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20 hover:text-cyan-200"
              >
                <FolderOpen className="h-4 w-4" />
                {dirBusy ? '変更中...' : '保存先フォルダを変更'}
              </Button>
              <p className="mt-2 text-xs text-slate-500">
                既存の暗号化データは新しいフォルダへ移動されます。
              </p>
            </div>
          </section>

          {/* マスターパスワード変更（設定済みのときのみ表示） */}
          {hasMaster && (
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <KeyRound className="h-3.5 w-3.5" />
              マスターパスワードの変更
            </h3>

            {pwError && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <p className="text-sm text-rose-300">{pwError}</p>
              </div>
            )}
            {pwDone && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5">
                <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                <p className="text-sm text-emerald-300">パスワードを変更しました</p>
              </div>
            )}

            <form onSubmit={changePassword} className="space-y-3">
              <Input
                type="password"
                value={oldPw}
                onChange={(e) => setOldPw(e.target.value)}
                placeholder="現在のマスターパスワード"
              />
              <Input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="新しいマスターパスワード（8文字以上）"
              />
              <Input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="新しいマスターパスワード（確認）"
              />
              <Button
                type="submit"
                disabled={busy}
                variant="outline"
                className="w-full border-cyan-400/30 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20 hover:text-cyan-200"
              >
                パスワードを変更
              </Button>
            </form>
          </section>
          )}

          {/* 危険な操作：全削除（登録が1件以上のときのみ表示） */}
          {passwordCount > 0 && (
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-400/80">
              <Trash2 className="h-3.5 w-3.5" />
              データの全削除
            </h3>
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3">
              <p className="mb-3 text-sm text-slate-300">
                登録されている {passwordCount} 件のパスワードをすべて削除します。
                この操作は取り消せません。
              </p>
              <Button
                onClick={onDeleteAll}
                disabled={passwordCount === 0}
                variant="destructive"
                className="w-full bg-rose-500/10 text-rose-300 border border-rose-500/40 bg-none hover:bg-rose-500/20 hover:text-rose-200 hover:shadow-none"
              >
                <Trash2 className="h-4 w-4" />
                すべて削除
              </Button>
            </div>
          </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
