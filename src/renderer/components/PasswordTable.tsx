import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  ExternalLink,
  Inbox,
  Star,
} from 'lucide-react';
import type { PasswordEntry } from '../../services/keepassImporter';
import { MIME_ENTRY } from './FolderList';

interface PasswordTableProps {
  entries: PasswordEntry[];
  onEdit: (entry: PasswordEntry) => void;
  onToggleFavorite: (id: string) => void;
}

export function PasswordTable({ entries, onEdit, onToggleFavorite }: PasswordTableProps) {
  // パスワード表示中の行ID
  const [visible, setVisible] = useState<Set<string>>(new Set());
  // 直近コピーしたフィールドのキー（"id:field"）
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const toggleVisible = (id: string) => {
    setVisible((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const copy = async (text: string, key: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
  };

  const openUrl = (url: string) => {
    if (!url) return;
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Inbox className="h-10 w-10 text-slate-600" strokeWidth={1.5} />
        <p className="text-sm">このフォルダにはエントリがありません</p>
      </div>
    );
  }

  const iconBtn =
    'rounded-md p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-cyan-300';

  return (
    <div className="flex-1 overflow-auto px-4 py-3">
      <table className="w-full border-separate border-spacing-y-1.5 text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500">
          <tr>
            <th className="whitespace-nowrap px-2.5 py-2 font-medium">タイトル</th>
            <th className="whitespace-nowrap px-2.5 py-2 font-medium">ユーザー名</th>
            <th className="whitespace-nowrap px-2.5 py-2 font-medium">パスワード</th>
            <th className="whitespace-nowrap px-2.5 py-2 font-medium">ウェブサイト</th>
            <th className="whitespace-nowrap px-2.5 py-2 font-medium">メモ</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isVisible = visible.has(entry.id);
            return (
              <tr
                key={entry.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(MIME_ENTRY, entry.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                className="group cursor-grab align-middle [&>td]:bg-white/[0.03] [&>td]:transition hover:[&>td]:bg-white/[0.07] active:cursor-grabbing [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl [&>td]:border-y [&>td]:border-white/5 [&>td:first-child]:border-l [&>td:last-child]:border-r"
              >
                {/* タイトル（ダブルクリックで編集） */}
                <td
                  className="cursor-pointer select-none px-2.5 py-2 font-medium text-white"
                  onDoubleClick={() => onEdit(entry)}
                  title="ダブルクリックで編集"
                >
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(entry.id);
                      }}
                      onDoubleClick={(e) => e.stopPropagation()}
                      className={`shrink-0 rounded-md p-1 transition ${
                        entry.favorite
                          ? 'text-amber-400 hover:text-amber-300'
                          : 'text-slate-600 hover:bg-white/10 hover:text-amber-300'
                      }`}
                      title={entry.favorite ? 'お気に入りを解除' : 'お気に入りに登録'}
                    >
                      <Star
                        className="h-4 w-4"
                        fill={entry.favorite ? 'currentColor' : 'none'}
                      />
                    </button>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400/20 to-violet-500/20 text-xs font-bold uppercase text-cyan-300 ring-1 ring-inset ring-white/10">
                      {entry.title.slice(0, 1) || '?'}
                    </span>
                    <span className="truncate">{entry.title}</span>
                  </div>
                </td>

                {/* ユーザー名 */}
                <td className="px-2.5 py-2 text-slate-300">
                  {entry.username ? (
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[180px]">
                        {entry.username}
                      </span>
                      <button
                        onClick={() => copy(entry.username, `${entry.id}:user`)}
                        className={iconBtn}
                        title="コピー"
                      >
                        {copiedKey === `${entry.id}:user` ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>

                {/* パスワード */}
                <td className="px-2.5 py-2 text-slate-300">
                  {entry.password ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono truncate max-w-[160px] tracking-tight">
                        {isVisible ? entry.password : '••••••••'}
                      </span>
                      <button
                        onClick={() => toggleVisible(entry.id)}
                        className={iconBtn}
                        title={isVisible ? '隠す' : '表示'}
                      >
                        {isVisible ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => copy(entry.password, `${entry.id}:pass`)}
                        className={iconBtn}
                        title="コピー"
                      >
                        {copiedKey === `${entry.id}:pass` ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>

                {/* ウェブサイト */}
                <td className="px-2.5 py-2">
                  {entry.url ? (
                    <button
                      onClick={() => openUrl(entry.url)}
                      className="flex items-center gap-1.5 text-cyan-400 transition hover:text-cyan-300 hover:underline"
                    >
                      <span className="truncate max-w-[160px]">{entry.url}</span>
                      <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                    </button>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>

                {/* メモ */}
                <td className="px-2.5 py-2 text-slate-400">
                  {entry.notes ? (
                    <span
                      className="block max-w-[200px] truncate"
                      title={entry.notes}
                    >
                      {entry.notes}
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
