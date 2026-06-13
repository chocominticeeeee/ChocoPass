import React, { useEffect, useState } from 'react';
import { X, Moon, Sun, KeyRound, Check, AlertCircle, FolderOpen, Trash2 } from 'lucide-react';
import type { Theme } from '../theme';

interface SettingsModalProps {
  theme: Theme;
  onChangeTheme: (theme: Theme) => void;
  onClose: () => void;
  /** 登録件数（全削除ボタンの活性判定用） */
  passwordCount: number;
  /** すべてのパスワードを削除 */
  onDeleteAll: () => void;
}

export function SettingsModal({
  theme,
  onChangeTheme,
  onClose,
  passwordCount,
  onDeleteAll,
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

  const inputClass =
    'w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-cyan-400/50 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/20';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="glass-strong relative w-full max-w-xl animate-scale-in overflow-hidden rounded-2xl shadow-2xl shadow-black/60">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />

        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <h2 className="font-display text-xl font-bold text-white">設定</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

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
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
                <button
                  onClick={() => onChangeTheme('dark')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    theme === 'dark'
                      ? 'bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Moon className="h-4 w-4" />
                  ダーク
                </button>
                <button
                  onClick={() => onChangeTheme('light')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    theme === 'light'
                      ? 'bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sun className="h-4 w-4" />
                  ライト
                </button>
              </div>
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
              <button
                onClick={changeDataDir}
                disabled={dirBusy}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/20 active:scale-[0.98] disabled:opacity-60"
              >
                <FolderOpen className="h-4 w-4" />
                {dirBusy ? '変更中...' : '保存先フォルダを変更'}
              </button>
              <p className="mt-2 text-xs text-slate-500">
                既存の暗号化データは新しいフォルダへ移動されます。
              </p>
            </div>
          </section>

          {/* マスターパスワード変更 */}
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
              <input
                type="password"
                value={oldPw}
                onChange={(e) => setOldPw(e.target.value)}
                placeholder="現在のマスターパスワード"
                className={inputClass}
              />
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="新しいマスターパスワード（8文字以上）"
                className={inputClass}
              />
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="新しいマスターパスワード（確認）"
                className={inputClass}
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/20 active:scale-[0.98] disabled:opacity-60"
              >
                パスワードを変更
              </button>
            </form>
          </section>

          {/* 危険な操作：全削除 */}
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
              <button
                onClick={onDeleteAll}
                disabled={passwordCount === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                すべて削除
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
