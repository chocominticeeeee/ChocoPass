import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FolderPlus,
  LayoutGrid,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  Smile,
  RotateCcw,
  Star,
} from 'lucide-react';
import type { PasswordEntry } from '../../services/keepassImporter';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

/** フォルダに割り当て可能な絵文字 */
const FOLDER_EMOJIS = [
  '📁', '📂', '⭐', '❤️', '💼', '🏠', '🌐', '✉️',
  '💳', '🛒', '🎮', '🎵', '💻', '🖥️', '🗄️', '🔒',
  '🔑', '👤', '👥', '🏢', '☁️', '👛', '📱', '🔖',
  '🏷️', '🚩', '🔔', '🎬', '📷', '🎨', '🍕', '✈️',
  '🏦', '🎓', '⚙️', '📝', '💰', '🔐', '🎯', '📌',
  '📦',
];

export const UNGROUPED = '未分類';
/** 「すべて」を表す特別なフォルダキー */
export const ALL_FOLDERS = '__ALL__';
/** 「お気に入り」を表す特別なフォルダキー */
export const FAVORITES = '__FAV__';
/** 階層の区切り文字 */
export const PATH_SEP = '/';

/** ドラッグ＆ドロップで受け渡す MIME タイプ */
export const MIME_ENTRY = 'application/x-chocopass-entry';
const MIME_FOLDER = 'application/x-chocopass-folder';

interface FolderNode {
  name: string;
  path: string;
  children: Map<string, FolderNode>;
  /** このフォルダ直下のエントリ数 */
  count: number;
}

interface FolderListProps {
  entries: PasswordEntry[];
  selectedFolder: string | null;
  onSelectFolder: (folder: string) => void;
  /** エントリを別フォルダへ移動（targetPath が空文字なら未分類） */
  onMoveEntry: (entryId: string, targetPath: string) => void;
  /** フォルダ（サブツリー）を別フォルダ配下へ移動（targetPath が空文字ならルート） */
  onMoveFolder: (sourcePath: string, targetPath: string) => void;
  /** フォルダ名を変更（末端名を newLeaf に） */
  onRenameFolder: (path: string, newLeaf: string) => void;
  /** フォルダを削除（配下のエントリ・サブフォルダごと） */
  onDeleteFolder: (path: string) => void;
}

export const EMPTY_FOLDERS_KEY = 'chocopass-empty-folders';
export const FOLDER_ICONS_KEY = 'chocopass-folder-icons';

/** エントリ群（＋空フォルダ）からフォルダツリーを構築する */
function buildTree(
  entries: PasswordEntry[],
  extraFolders: Set<string>
): {
  roots: FolderNode[];
  ungroupedCount: number;
} {
  const root: FolderNode = {
    name: '',
    path: '',
    children: new Map(),
    count: 0,
  };
  let ungroupedCount = 0;

  // パスをたどって（無ければ作って）末端ノードを返す
  const ensurePath = (raw: string): FolderNode => {
    const parts = raw.split(PATH_SEP).map((s) => s.trim()).filter(Boolean);
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const path = parts.slice(0, i + 1).join(PATH_SEP);
      if (!node.children.has(name)) {
        node.children.set(name, {
          name,
          path,
          children: new Map(),
          count: 0,
        });
      }
      node = node.children.get(name)!;
    }
    return node;
  };

  for (const entry of entries) {
    const raw = entry.group?.trim() ?? '';
    if (!raw) {
      ungroupedCount++;
      continue;
    }
    ensurePath(raw).count++;
  }

  // 明示的に作成された空フォルダもノードとして用意する
  for (const p of extraFolders) {
    const raw = p.trim();
    if (raw) ensurePath(raw);
  }

  const sortNodes = (nodes: FolderNode[]) =>
    nodes.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  return { roots: sortNodes(Array.from(root.children.values())), ungroupedCount };
}

/** パス集合に対し、oldPath（とその子孫）を newBase へ付け替える */
function rewritePaths(set: Set<string>, oldPath: string, newBase: string): Set<string> {
  const next = new Set<string>();
  set.forEach((p) => {
    if (p === oldPath || p.startsWith(oldPath + PATH_SEP)) {
      next.add(newBase + p.slice(oldPath.length));
    } else {
      next.add(p);
    }
  });
  return next;
}

/** パス→値のマップに対し、oldPath（とその子孫）を newBase へ付け替える */
function rewriteMap(
  map: Record<string, string>,
  oldPath: string,
  newBase: string
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [p, value] of Object.entries(map)) {
    if (p === oldPath || p.startsWith(oldPath + PATH_SEP)) {
      next[newBase + p.slice(oldPath.length)] = value;
    } else {
      next[p] = value;
    }
  }
  return next;
}

/** パス→値のマップから、path（とその子孫）のエントリを取り除く */
function pruneMap(map: Record<string, string>, path: string): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [p, value] of Object.entries(map)) {
    if (!(p === path || p.startsWith(path + PATH_SEP))) next[p] = value;
  }
  return next;
}

/** ノードとその子孫の合計エントリ数 */
function totalCount(node: FolderNode): number {
  let sum = node.count;
  for (const child of node.children.values()) {
    sum += totalCount(child);
  }
  return sum;
}

export function FolderList({
  entries,
  selectedFolder,
  onSelectFolder,
  onMoveEntry,
  onMoveFolder,
  onRenameFolder,
  onDeleteFolder,
}: FolderListProps) {
  // 折りたたみ中のフォルダパス（既定は空＝すべて展開）
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // ドラッグオーバー中のドロップ先（ハイライト用）。'' はルート/未分類
  const [dragOver, setDragOver] = useState<string | null>(null);
  // 右クリックメニュー（対象フォルダパス・表示位置・表示モード）
  const [menu, setMenu] = useState<{
    path: string;
    x: number;
    y: number;
    mode: 'main' | 'icon';
  } | null>(null);
  // 削除確認モーダルの対象フォルダパス（null なら非表示）
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  // 名前変更中のフォルダパスと入力値
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  // 明示的に作成された空フォルダ（エントリを持たないフォルダ）。localStorage に永続化
  const [extraFolders, setExtraFolders] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(EMPTY_FOLDERS_KEY);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {
      /* noop */
    }
    return new Set();
  });

  useEffect(() => {
    localStorage.setItem(EMPTY_FOLDERS_KEY, JSON.stringify([...extraFolders]));
  }, [extraFolders]);

  // フォルダごとのアイコン（パス → アイコン名）。localStorage に永続化
  const [folderIcons, setFolderIcons] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(FOLDER_ICONS_KEY);
      if (raw) return JSON.parse(raw) as Record<string, string>;
    } catch {
      /* noop */
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem(FOLDER_ICONS_KEY, JSON.stringify(folderIcons));
  }, [folderIcons]);

  // フォルダにアイコンを割り当てる（name が null なら既定に戻す）
  const setFolderIcon = (path: string, name: string | null) => {
    setFolderIcons((prev) => {
      const next = { ...prev };
      if (name) next[path] = name;
      else delete next[path];
      return next;
    });
    setMenu(null);
  };

  const { roots, ungroupedCount } = buildTree(entries, extraFolders);
  const favoriteCount = entries.filter((e) => e.favorite).length;

  // メニュー表示中はどこかをクリック / Esc で閉じる
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  // 名前変更を開始したら入力にフォーカスして全選択
  useEffect(() => {
    if (renaming !== null) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renaming]);

  const startRename = (path: string) => {
    const leaf = path.includes(PATH_SEP)
      ? path.slice(path.lastIndexOf(PATH_SEP) + 1)
      : path;
    setRenameValue(leaf);
    setRenaming(path);
    setMenu(null);
  };

  const commitRename = () => {
    if (renaming !== null) {
      const leaf = renaming.includes(PATH_SEP)
        ? renaming.slice(renaming.lastIndexOf(PATH_SEP) + 1)
        : renaming;
      const next = renameValue.trim();
      if (next && next !== leaf) {
        const parent = renaming.includes(PATH_SEP)
          ? renaming.slice(0, renaming.lastIndexOf(PATH_SEP))
          : '';
        const newBase = parent ? `${parent}${PATH_SEP}${next}` : next;
        // 空フォルダのパスも追従させる
        setExtraFolders((prev) => rewritePaths(prev, renaming, newBase));
        // アイコン割り当ても追従させる
        setFolderIcons((prev) => rewriteMap(prev, renaming, newBase));
        // エントリを持つフォルダは App 側で実体（group）を付け替える
        onRenameFolder(renaming, next);
      }
    }
    setRenaming(null);
  };

  // 既存のすべてのフォルダパスを集める（一意な名前を作るため）
  const collectPaths = (): Set<string> => {
    const paths = new Set<string>(extraFolders);
    const walk = (nodes: FolderNode[]) => {
      for (const n of nodes) {
        paths.add(n.path);
        walk([...n.children.values()]);
      }
    };
    walk(roots);
    return paths;
  };

  // 新規フォルダを作成（parentPath が '' ならルート）。作成後に名前変更を開始する
  const createFolder = (parentPath: string) => {
    const baseName = '新しいフォルダ';
    const basePath = parentPath ? `${parentPath}${PATH_SEP}${baseName}` : baseName;
    const existing = collectPaths();
    let path = basePath;
    let i = 2;
    while (existing.has(path)) {
      path = `${basePath} ${i++}`;
    }
    setExtraFolders((prev) => new Set(prev).add(path));
    // 親を展開しておく
    if (parentPath) {
      setCollapsed((prev) => {
        const n = new Set(prev);
        n.delete(parentPath);
        return n;
      });
    }
    setMenu(null);
    onSelectFolder(path);
    const leaf = path.includes(PATH_SEP)
      ? path.slice(path.lastIndexOf(PATH_SEP) + 1)
      : path;
    setRenameValue(leaf);
    setRenaming(path);
  };

  const toggle = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  // 削除確認モーダルで「削除」を押したときの実処理
  const confirmDeleteFolder = (path: string) => {
    onDeleteFolder(path);
    // 配下の空フォルダも取り除く
    setExtraFolders((prev) => {
      const next = new Set<string>();
      prev.forEach((p) => {
        if (!(p === path || p.startsWith(path + PATH_SEP))) next.add(p);
      });
      return next;
    });
    // 配下のアイコン割り当ても取り除く
    setFolderIcons((prev) => pruneMap(prev, path));
    setPendingDelete(null);
  };

  // 削除対象フォルダ配下のエントリ数（確認文言用）
  const pendingDeleteCount =
    pendingDelete === null
      ? 0
      : entries.filter((p) => {
          const g = p.group?.trim() ?? '';
          return g === pendingDelete || g.startsWith(pendingDelete + PATH_SEP);
        }).length;

  /** ドロップ処理。target が '' ならルート/未分類への移動 */
  const handleDrop = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);

    const entryId = e.dataTransfer.getData(MIME_ENTRY);
    if (entryId) {
      onMoveEntry(entryId, targetPath);
      return;
    }

    const folderPath = e.dataTransfer.getData(MIME_FOLDER);
    if (folderPath && folderPath !== targetPath) {
      // 自分自身の子孫へは移動できない
      if (targetPath === folderPath || targetPath.startsWith(folderPath + PATH_SEP)) {
        return;
      }
      // 既に同じ親にいる場合は何もしない
      const parent = folderPath.includes(PATH_SEP)
        ? folderPath.slice(0, folderPath.lastIndexOf(PATH_SEP))
        : '';
      if (parent === targetPath) return;
      // 空フォルダのパスも追従させる
      const leaf = folderPath.includes(PATH_SEP)
        ? folderPath.slice(folderPath.lastIndexOf(PATH_SEP) + 1)
        : folderPath;
      const newBase = targetPath ? `${targetPath}${PATH_SEP}${leaf}` : leaf;
      setExtraFolders((prev) => rewritePaths(prev, folderPath, newBase));
      setFolderIcons((prev) => rewriteMap(prev, folderPath, newBase));
      onMoveFolder(folderPath, targetPath);
    }
  };

  const allowDrop = (e: React.DragEvent, targetPath: string) => {
    // ドラッグ中のデータ種別を問わず受け入れる
    if (
      e.dataTransfer.types.includes(MIME_ENTRY) ||
      e.dataTransfer.types.includes(MIME_FOLDER)
    ) {
      e.preventDefault();
      setDragOver(targetPath);
    }
  };

  const rowClass = (active: boolean, isDragOver: boolean) =>
    `group relative my-0.5 w-full flex items-center gap-1.5 rounded-lg pr-3 py-2 text-left transition cursor-pointer ${
      active
        ? 'bg-gradient-to-r from-cyan-400/15 to-violet-500/10 text-cyan-200 ring-1 ring-inset ring-cyan-400/30'
        : isDragOver
        ? 'bg-cyan-400/10 ring-1 ring-inset ring-cyan-400/50'
        : 'text-slate-300 hover:bg-white/5 hover:text-white'
    }`;

  const renderNode = (node: FolderNode, depth: number): React.ReactNode => {
    const active = selectedFolder === node.path;
    const isOpen = !collapsed.has(node.path);
    const hasChildren = node.children.size > 0;
    const isDragOver = dragOver === node.path;

    const isRenaming = renaming === node.path;

    return (
      <div key={node.path}>
        <div
          draggable={!isRenaming}
          onDragStart={(e) => {
            e.dataTransfer.setData(MIME_FOLDER, node.path);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => allowDrop(e, node.path)}
          onDragLeave={() => setDragOver((p) => (p === node.path ? null : p))}
          onDrop={(e) => handleDrop(e, node.path)}
          onClick={() => !isRenaming && onSelectFolder(node.path)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenu({ path: node.path, x: e.clientX, y: e.clientY, mode: 'main' });
          }}
          className={rowClass(active, isDragOver)}
          style={{ paddingLeft: depth * 14 + 8 }}
          title={node.path}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggle(node.path);
              }}
              className="flex-shrink-0 text-slate-500 transition hover:text-cyan-300"
            >
              {isOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <span className="w-4 flex-shrink-0" />
          )}
          <span className="flex w-4 flex-shrink-0 items-center justify-center text-sm leading-none">
            {folderIcons[node.path] ?? (active || (isOpen && hasChildren) ? '📂' : '📁')}
          </span>
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                else if (e.key === 'Escape') setRenaming(null);
              }}
              className="flex-1 min-w-0 rounded border border-cyan-400/60 bg-slate-900/80 px-1.5 py-0.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
          ) : (
            <>
              <span className="text-sm font-medium truncate flex-1">
                {node.name}
              </span>
              <span className="text-xs text-slate-500 group-hover:text-slate-400">
                {totalCount(node)}
              </span>
            </>
          )}
        </div>

        {hasChildren && isOpen && (
          <div>
            {Array.from(node.children.values())
              .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
              .map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="py-2"
      onContextMenu={(e) => {
        // 空白部分の右クリックでルート直下に新規フォルダ
        e.preventDefault();
        setMenu({ path: '', x: e.clientX, y: e.clientY, mode: 'main' });
      }}
    >
      {/* お気に入り（最上部・お気に入りが1件以上あるときだけ表示） */}
      {favoriteCount > 0 && (
        <div
          onClick={() => onSelectFolder(FAVORITES)}
          className={rowClass(selectedFolder === FAVORITES, false)}
          style={{ paddingLeft: 8 }}
        >
          <span className="w-4 flex-shrink-0" />
          <Star
            className="w-4 h-4 flex-shrink-0 text-amber-400"
            fill="currentColor"
          />
          <span className="text-sm font-semibold truncate flex-1">
            お気に入り
          </span>
          <span className="text-xs text-slate-500">{favoriteCount}</span>
        </div>
      )}

      {/* すべて（ドロップでルート/未分類へ移動） */}
      <div
        onClick={() => onSelectFolder(ALL_FOLDERS)}
        onDragOver={(e) => allowDrop(e, '')}
        onDragLeave={() => setDragOver((p) => (p === '' ? null : p))}
        onDrop={(e) => handleDrop(e, '')}
        className={rowClass(selectedFolder === ALL_FOLDERS, dragOver === '')}
        style={{ paddingLeft: 8 }}
      >
        <span className="w-4 flex-shrink-0" />
        <LayoutGrid className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-semibold truncate flex-1">すべて</span>
        <span className="text-xs text-slate-500">{entries.length}</span>
      </div>

      {roots.map((node) => renderNode(node, 0))}

      {/* 未分類（グループ未設定のエントリ） */}
      {ungroupedCount > 0 && (
        <div
          onClick={() => onSelectFolder(UNGROUPED)}
          onDragOver={(e) => allowDrop(e, '')}
          onDragLeave={() => setDragOver((p) => (p === '' ? null : p))}
          onDrop={(e) => handleDrop(e, '')}
          className={rowClass(selectedFolder === UNGROUPED, false)}
          style={{ paddingLeft: 8 }}
        >
          <span className="w-4 flex-shrink-0" />
          <span className="flex w-4 flex-shrink-0 items-center justify-center text-sm leading-none">
            📁
          </span>
          <span className="text-sm font-medium truncate flex-1">{UNGROUPED}</span>
          <span className="text-xs text-slate-500">{ungroupedCount}</span>
        </div>
      )}

      {/* 右クリックコンテキストメニュー（body 直下に描画して位置ズレを防ぐ） */}
      {menu &&
        createPortal(
          <div
            className={`glass-strong fixed z-[100] animate-scale-in rounded-xl p-1.5 text-sm shadow-2xl shadow-black/50 ${
              menu.mode === 'icon' ? 'w-[300px]' : 'min-w-[180px]'
            }`}
            style={{
              top: Math.min(menu.y, window.innerHeight - (menu.mode === 'icon' ? 240 : 160)),
              left: Math.min(menu.x, window.innerWidth - (menu.mode === 'icon' ? 312 : 240)),
            }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            {menu.mode === 'icon' ? (
              <>
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-xs font-semibold text-slate-400">絵文字を選択</span>
                  <button
                    onClick={() => setFolderIcon(menu.path, null)}
                    title="既定に戻す"
                    className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-slate-400 transition hover:bg-white/10 hover:text-cyan-200"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    既定
                  </button>
                </div>
                <div className="grid grid-cols-8 gap-1 px-1 pb-1">
                  {FOLDER_EMOJIS.map((emoji) => {
                    const selected = folderIcons[menu.path] === emoji;
                    return (
                      <button
                        key={emoji}
                        onClick={() => setFolderIcon(menu.path, emoji)}
                        title={emoji}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg leading-none transition ${
                          selected
                            ? 'bg-cyan-400/20 ring-1 ring-inset ring-cyan-400/40'
                            : 'hover:bg-white/10'
                        }`}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => createFolder(menu.path)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-slate-200 transition hover:bg-cyan-400/10 hover:text-cyan-200"
                >
                  <FolderPlus className="h-4 w-4" />
                  {menu.path ? '新規サブフォルダ' : '新規フォルダ'}
                </button>

                {menu.path && (
                  <>
                    <div className="my-1 h-px bg-white/10" />
                    <button
                      onClick={() => setMenu({ ...menu, mode: 'icon' })}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-slate-200 transition hover:bg-cyan-400/10 hover:text-cyan-200"
                    >
                      <Smile className="h-4 w-4" />
                      絵文字を変更
                    </button>
                    <button
                      onClick={() => startRename(menu.path)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-slate-200 transition hover:bg-cyan-400/10 hover:text-cyan-200"
                    >
                      <Pencil className="h-4 w-4" />
                      名前を変更
                    </button>
                    <button
                      onClick={() => {
                        setPendingDelete(menu.path);
                        setMenu(null);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                      削除
                    </button>
                  </>
                )}
              </>
            )}
          </div>,
          document.body
        )}

      {/* フォルダ削除の確認モーダル（shadcn AlertDialog） */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>フォルダを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete !== null && (
                <>
                  フォルダ「
                  <span className="font-semibold text-slate-200">
                    {pendingDelete.includes(PATH_SEP)
                      ? pendingDelete.slice(pendingDelete.lastIndexOf(PATH_SEP) + 1)
                      : pendingDelete}
                  </span>
                  」
                  {pendingDeleteCount > 0 ? (
                    <>
                      と、その中の{' '}
                      <span className="font-semibold text-rose-300">{pendingDeleteCount}</span>{' '}
                      件のパスワードを削除します。
                    </>
                  ) : (
                    'を削除します。'
                  )}
                  <br />
                  この操作は取り消せません。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete !== null && confirmDeleteFolder(pendingDelete)}
            >
              <Trash2 className="h-4 w-4" />
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
