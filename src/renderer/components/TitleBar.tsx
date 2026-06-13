import React, { useEffect, useState } from 'react';
import { Minus, Square, Copy, X, Settings, Lock, ShieldCheck, Moon, Sun } from 'lucide-react';
import type { Theme } from '../theme';

interface TitleBarProps {
  /** 設定ボタン押下 */
  onOpenSettings: () => void;
  /** ロック（マスターパスワード再入力へ） */
  onLock?: () => void;
  /** 現在のテーマ */
  theme: Theme;
  /** テーマ切替 */
  onToggleTheme: () => void;
}

export function TitleBar({ onOpenSettings, onLock, theme, onToggleTheme }: TitleBarProps) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let active = true;
    window.electron?.ipc.invoke('window-is-maximized').then((m: boolean) => {
      if (active) setMaximized(!!m);
    });
    // main から最大化状態の変化を受け取る
    window.electron?.ipc.on('window-maximized-changed', (_e: unknown, m: boolean) => {
      setMaximized(!!m);
    });
    return () => {
      active = false;
    };
  }, []);

  const minimize = () => window.electron?.ipc.invoke('window-minimize');
  const toggleMaximize = () => window.electron?.ipc.invoke('window-maximize-toggle');
  const close = () => window.electron?.ipc.invoke('window-close');

  return (
    <div className="titlebar-drag relative z-30 flex h-10 shrink-0 items-center justify-between border-b border-white/10 glass-strong pl-3 pr-0 select-none">
      {/* 左：ブランド */}
      <div className="flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-cyan-400 to-violet-500">
          <ShieldCheck className="h-3.5 w-3.5 text-slate-950" strokeWidth={2.6} />
        </div>
        <span className="font-display text-sm font-semibold tracking-tight text-slate-300">
          ChocoPass
        </span>
      </div>

      {/* 右：操作系（ドラッグ無効領域） */}
      <div className="titlebar-no-drag flex items-center">
        {onLock && (
          <button
            onClick={onLock}
            title="ロック"
            className="flex h-10 w-11 items-center justify-center text-slate-400 transition hover:bg-white/10 hover:text-cyan-300"
          >
            <Lock className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'ライトモードに切替' : 'ダークモードに切替'}
          className="flex h-10 w-11 items-center justify-center text-slate-400 transition hover:bg-white/10 hover:text-cyan-300"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          onClick={onOpenSettings}
          title="設定"
          className="flex h-10 w-11 items-center justify-center text-slate-400 transition hover:bg-white/10 hover:text-cyan-300"
        >
          <Settings className="h-4 w-4" />
        </button>

        <div className="mx-1 h-5 w-px bg-white/10" />

        <button
          onClick={minimize}
          title="最小化"
          className="flex h-10 w-11 items-center justify-center text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={toggleMaximize}
          title={maximized ? '元のサイズに戻す' : '最大化'}
          className="flex h-10 w-11 items-center justify-center text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          {maximized ? <Copy className="h-3.5 w-3.5 -scale-x-100" /> : <Square className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={close}
          title="閉じる"
          className="flex h-10 w-12 items-center justify-center text-slate-400 transition hover:bg-rose-500 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
