import React, { useEffect, useRef, useState } from 'react';
import { ImportModal } from './components/ImportModal';
import { EntryFormModal } from './components/EntryFormModal';
import {
  FolderList,
  ALL_FOLDERS,
  UNGROUPED,
  FAVORITES,
  PATH_SEP,
  EMPTY_FOLDERS_KEY,
  FOLDER_ICONS_KEY,
} from './components/FolderList';
import { PasswordTable } from './components/PasswordTable';
import { TitleBar } from './components/TitleBar';
import { MasterPasswordScreen } from './components/MasterPasswordScreen';
import { SettingsModal } from './components/SettingsModal';
import { getStoredTheme, applyTheme, type Theme } from './theme';
import type { PasswordEntry } from '../services/keepassImporter';
import { Plus, Upload, Search } from 'lucide-react';
import avatarUrl from './assets/アバター透過.png';
import logoUrl from './assets/logo.png';

type AuthState = 'loading' | 'setup' | 'unlock' | 'unlocked';

export function App() {
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>(ALL_FOLDERS);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PasswordEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [theme, setTheme] = useState<Theme>('dark');
  // サイドバー幅（ドラッグでリサイズ）
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('chocopass-sidebar-width'));
    return saved >= 200 && saved <= 560 ? saved : 288;
  });
  const resizingRef = useRef(false);
  // 読み込み直後の空配列で保存上書きしないためのガード
  const loadedRef = useRef(false);
  // 全削除時に FolderList を再マウントしてフォルダ状態を作り直すためのキー
  const [vaultEpoch, setVaultEpoch] = useState(0);

  // サイドバー幅を保存
  useEffect(() => {
    localStorage.setItem('chocopass-sidebar-width', String(sidebarWidth));
  }, [sidebarWidth]);

  // 仕切りのドラッグ開始
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      // サイドバーは左端始まりなので clientX がそのまま幅になる
      setSidebarWidth(Math.min(560, Math.max(200, ev.clientX)));
    };
    const onUp = () => {
      resizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // 起動時：テーマを適用し、マスターパスワードの状態を確認する
  useEffect(() => {
    const t = getStoredTheme();
    setTheme(t);
    applyTheme(t);

    (async () => {
      const status = await window.electron?.ipc.invoke('auth-status');
      setAuthState(status?.hasMaster ? 'unlock' : 'setup');
    })();
  }, []);

  // 実行中に別の .cdb がダブルクリックで開かれたら、ロック画面に戻して状態を取り直す
  useEffect(() => {
    const handler = async () => {
      loadedRef.current = false;
      setPasswords([]);
      setShowSettings(false);
      setShowImportModal(false);
      setShowFormModal(false);
      setSearchTerm('');
      setSelectedFolder(ALL_FOLDERS);
      const status = await window.electron?.ipc.invoke('auth-status');
      setAuthState(status?.hasMaster ? 'unlock' : 'setup');
    };
    window.electron?.ipc.on('open-cdb', handler);
  }, []);

  // 変更があるたびに永続保存する（ロック解除後のみ）
  useEffect(() => {
    if (!loadedRef.current) return;
    window.electron?.ipc.invoke('save-vault', passwords);
  }, [passwords]);

  // ロック解除 / 初回設定の完了
  const handleUnlocked = (entries: PasswordEntry[]) => {
    setPasswords(entries);
    setSelectedFolder(ALL_FOLDERS);
    loadedRef.current = true;
    setAuthState('unlocked');
  };

  // ロックする（マスターパスワード再入力へ）
  const handleLock = async () => {
    loadedRef.current = false;
    await window.electron?.ipc.invoke('lock-vault');
    setPasswords([]);
    setShowSettings(false);
    setSearchTerm('');
    setAuthState('unlock');
  };

  const handleChangeTheme = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  const handleImportSuccess = (entries: PasswordEntry[]) => {
    setPasswords((prev) => [...prev, ...entries]);
    setShowImportModal(false);
  };

  const handleNew = () => {
    setEditingEntry(null);
    setShowFormModal(true);
  };

  const handleEdit = (entry: PasswordEntry) => {
    setEditingEntry(entry);
    setShowFormModal(true);
  };

  const handleSave = (entry: PasswordEntry) => {
    setPasswords((prev) => {
      const exists = prev.some((p) => p.id === entry.id);
      return exists
        ? prev.map((p) => (p.id === entry.id ? entry : p))
        : [...prev, entry];
    });
    setShowFormModal(false);
    setEditingEntry(null);
  };

  const handleDelete = (id: string) => {
    setPasswords((prev) => prev.filter((p) => p.id !== id));
  };

  // お気に入りの登録/解除を切り替える
  const handleToggleFavorite = (id: string) => {
    setPasswords((prev) =>
      prev.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p))
    );
  };

  const handleDeleteAll = () => {
    if (passwords.length === 0) return;
    const ok = window.confirm(
      `すべてのパスワード（${passwords.length}件）を削除します。この操作は取り消せません。よろしいですか？`
    );
    if (!ok) return;
    setPasswords([]);
    // 明示的に作成した空フォルダと絵文字割り当ても消す
    localStorage.removeItem(EMPTY_FOLDERS_KEY);
    localStorage.removeItem(FOLDER_ICONS_KEY);
    setSelectedFolder(ALL_FOLDERS);
    // FolderList を再マウントして空の localStorage から作り直す
    setVaultEpoch((n) => n + 1);
  };

  // エントリを別フォルダへ移動（targetPath が空文字なら未分類）
  const handleMoveEntry = (entryId: string, targetPath: string) => {
    setPasswords((prev) =>
      prev.map((p) => (p.id === entryId ? { ...p, group: targetPath } : p))
    );
  };

  // フォルダ（サブツリーごと）を別フォルダ配下へ移動
  const handleMoveFolder = (sourcePath: string, targetPath: string) => {
    const leaf = sourcePath.includes(PATH_SEP)
      ? sourcePath.slice(sourcePath.lastIndexOf(PATH_SEP) + 1)
      : sourcePath;
    const newBase = targetPath ? `${targetPath}${PATH_SEP}${leaf}` : leaf;
    setPasswords((prev) =>
      prev.map((p) => {
        const g = p.group?.trim() ?? '';
        if (g === sourcePath || g.startsWith(sourcePath + PATH_SEP)) {
          // sourcePath より後ろの階層は維持したまま付け替える
          return { ...p, group: newBase + g.slice(sourcePath.length) };
        }
        return p;
      })
    );
    // 移動後のパスを選択状態に追従させる
    setSelectedFolder((sel) => {
      if (sel === sourcePath || (sel && sel.startsWith(sourcePath + PATH_SEP))) {
        return newBase + sel.slice(sourcePath.length);
      }
      return sel;
    });
  };

  // フォルダ名を変更（サブツリーのパスを付け替える）
  const handleRenameFolder = (path: string, newLeaf: string) => {
    const trimmed = newLeaf.trim();
    if (!trimmed) return;
    const parent = path.includes(PATH_SEP)
      ? path.slice(0, path.lastIndexOf(PATH_SEP))
      : '';
    const newBase = parent ? `${parent}${PATH_SEP}${trimmed}` : trimmed;
    if (newBase === path) return;
    setPasswords((prev) =>
      prev.map((p) => {
        const g = p.group?.trim() ?? '';
        if (g === path || g.startsWith(path + PATH_SEP)) {
          return { ...p, group: newBase + g.slice(path.length) };
        }
        return p;
      })
    );
    setSelectedFolder((sel) => {
      if (sel === path || (sel && sel.startsWith(path + PATH_SEP))) {
        return newBase + sel.slice(path.length);
      }
      return sel;
    });
  };

  // フォルダを削除（配下のエントリもサブフォルダごと削除）。削除が確定したら true
  const handleDeleteFolder = (path: string): boolean => {
    const targets = passwords.filter((p) => {
      const g = p.group?.trim() ?? '';
      return g === path || g.startsWith(path + PATH_SEP);
    });
    const ok = window.confirm(
      targets.length > 0
        ? `フォルダ「${path}」と、その中の ${targets.length} 件のパスワードを削除します。この操作は取り消せません。よろしいですか？`
        : `フォルダ「${path}」を削除します。よろしいですか？`
    );
    if (!ok) return false;
    setPasswords((prev) =>
      prev.filter((p) => {
        const g = p.group?.trim() ?? '';
        return !(g === path || g.startsWith(path + PATH_SEP));
      })
    );
    setSelectedFolder((sel) =>
      sel === path || (sel && sel.startsWith(path + PATH_SEP))
        ? ALL_FOLDERS
        : sel
    );
    return true;
  };

  // 選択中のフォルダに属するエントリ（サブフォルダも含める）
  const folderEntries = passwords.filter((entry) => {
    if (selectedFolder === ALL_FOLDERS) return true;
    if (selectedFolder === FAVORITES) return !!entry.favorite;
    const group = entry.group?.trim() ?? '';
    if (selectedFolder === UNGROUPED) return group === '';
    return (
      group === selectedFolder || group.startsWith(selectedFolder + PATH_SEP)
    );
  });

  // 検索でさらに絞り込む
  const term = searchTerm.toLowerCase();
  const visibleEntries = term
    ? folderEntries.filter(
        (entry) =>
          entry.title.toLowerCase().includes(term) ||
          entry.username.toLowerCase().includes(term) ||
          entry.url.toLowerCase().includes(term)
      )
    : folderEntries;

  const folderLabel =
    selectedFolder === ALL_FOLDERS
      ? 'すべて'
      : selectedFolder === FAVORITES
      ? 'お気に入り'
      : selectedFolder;

  return (
    <div className="flex h-screen flex-col overflow-hidden text-slate-200">
      {/* 自前のタイトルバー */}
      <TitleBar
        onOpenSettings={() => setShowSettings(true)}
        onLock={authState === 'unlocked' ? handleLock : undefined}
        theme={theme}
        onToggleTheme={() => handleChangeTheme(theme === 'dark' ? 'light' : 'dark')}
      />

      {authState === 'loading' ? (
        <div className="flex flex-1 items-center justify-center text-slate-500">
          読み込み中...
        </div>
      ) : authState !== 'unlocked' ? (
        <div className="min-h-0 flex-1">
          <MasterPasswordScreen
            mode={authState === 'setup' ? 'setup' : 'unlock'}
            onUnlocked={handleUnlocked}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* サイドバー：フォルダのみ */}
      <aside
        className="glass-strong flex flex-col border-r border-white/10 shrink-0"
        style={{ width: sidebarWidth }}
      >
        <div className="px-2 py-2 border-b border-white/10">
          <img
            src={logoUrl}
            alt="ちょこパス"
            className="h-auto mx-auto w-44 max-w-full object-contain"
          />
        </div>

        {/* フォルダ一覧 */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <FolderList
            key={vaultEpoch}
            entries={passwords}
            selectedFolder={selectedFolder}
            onSelectFolder={setSelectedFolder}
            onMoveEntry={handleMoveEntry}
            onMoveFolder={handleMoveFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
          />
        </div>

        <div className="px-4 py-3 border-t border-white/10">
          <p className="text-xs text-slate-500">
            <span className="font-semibold text-slate-300">{passwords.length}</span> 件のパスワード
          </p>
        </div>
      </aside>

      {/* リサイズ用の仕切り */}
      <div
        onMouseDown={startResize}
        className="group relative w-1 shrink-0 cursor-col-resize bg-white/5 transition hover:bg-cyan-400/40"
        title="ドラッグで幅を変更"
      >
        {/* 当たり判定を広げる透明領域 */}
        <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
      </div>

      {/* メインコンテンツ：選択フォルダのテーブル */}
      <main className="flex-1 flex flex-col min-w-0">
        {passwords.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center animate-fade-in">
              <div className="mx-auto mb-8 flex items-center justify-center gap-5">
                {/* ロゴ */}
                <img
                  src={logoUrl}
                  alt="ちょこパス"
                  className="h-28 w-auto max-w-[260px] object-contain"
                />
                {/* アバター（ロゴの右に配置） */}
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-32 w-auto animate-float object-contain"
                />
              </div>
              <h2 className="font-display text-3xl font-bold tracking-tight text-white mb-3">
                ChocoPass へようこそ
              </h2>
              <p className="text-slate-400 mb-8 max-w-sm mx-auto">
                新規登録するか、KeePass の CSV をインポートして、<br />
                あなたの認証情報を安全に管理しましょう。
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleNew}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-6 py-3 font-semibold text-slate-950 transition hover:shadow-[0_8px_30px_-6px_rgba(34,211,238,0.6)] hover:brightness-110 active:scale-[0.98]"
                >
                  <Plus className="h-5 w-5" strokeWidth={2.6} />
                  新規登録
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-medium text-slate-300 transition hover:border-cyan-400/40 hover:bg-white/10 hover:text-white active:scale-[0.98]"
                >
                  <Upload className="h-5 w-5" />
                  CSVインポート
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ヘッダー：フォルダ名 + 検索 */}
            <div className="flex items-center justify-between gap-4 px-8 py-5 border-b border-white/10 bg-white/[0.03]">
              <div className="min-w-0">
                <h2 className="font-display text-xl font-bold text-white truncate flex items-center gap-3">
                  {folderLabel}
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-xs font-medium text-cyan-300">
                    {visibleEntries.length}
                  </span>
                </h2>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="relative w-64">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-slate-200 placeholder:text-slate-500 transition focus:border-cyan-400/50 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                  />
                </div>
                <button
                  onClick={handleNew}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:shadow-[0_8px_30px_-6px_rgba(34,211,238,0.6)] hover:brightness-110 active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.6} />
                  新規登録
                </button>
              </div>
            </div>

            <PasswordTable
              entries={visibleEntries}
              onEdit={handleEdit}
              onToggleFavorite={handleToggleFavorite}
            />
          </>
        )}
      </main>
        </div>
      )}

      {/* インポートモーダル */}
      {showImportModal && (
        <ImportModal
          onSuccess={handleImportSuccess}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {/* 新規/編集フォーム */}
      {showFormModal && (
        <EntryFormModal
          entry={editingEntry ?? undefined}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => {
            setShowFormModal(false);
            setEditingEntry(null);
          }}
        />
      )}

      {/* 設定 */}
      {showSettings && (
        <SettingsModal
          theme={theme}
          onChangeTheme={handleChangeTheme}
          onClose={() => setShowSettings(false)}
          passwordCount={passwords.length}
          onDeleteAll={handleDeleteAll}
          hasMaster={authState === 'unlock' || authState === 'unlocked'}
        />
      )}
    </div>
  );
}
