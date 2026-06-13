import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  ExternalLink,
  Pencil,
  Trash2,
  Inbox,
} from 'lucide-react';
import type { PasswordEntry } from '../../services/keepassImporter';
import { MIME_ENTRY } from './FolderList';

interface PasswordTableProps {
  entries: PasswordEntry[];
  onEdit: (entry: PasswordEntry) => void;
  onDelete: (id: string) => void;
}

export function PasswordTable({ entries, onEdit, onDelete }: PasswordTableProps) {
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

  const handleDelete = (entry: PasswordEntry) => {
    if (window.confirm(`「${entry.title}」を削除しますか？`)) {
      onDelete(entry.id);
    }
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
    <div className="flex-1 overflow-auto px-6 py-4">
      <table className="w-full border-separate border-spacing-y-2 text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">タイトル</th>
            <th className="px-4 py-2 font-medium">ユーザー名</th>
            <th className="px-4 py-2 font-medium">パスワード</th>
            <th className="px-4 py-2 font-medium">ウェブサイト</th>
            <th className="px-4 py-2 text-right font-medium">操作</th>
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
                {/* タイトル */}
                <td className="px-4 py-3 font-medium text-white">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400/20 to-violet-500/20 text-xs font-bold uppercase text-cyan-300 ring-1 ring-inset ring-white/10">
                      {entry.title.slice(0, 1) || '?'}
                    </span>
                    <span className="truncate">{entry.title}</span>
                  </div>
                </td>

                {/* ユーザー名 */}
                <td className="px-4 py-3 text-slate-300">
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
                <td className="px-4 py-3 text-slate-300">
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
                <td className="px-4 py-3">
                  {entry.url ? (
                    <button
                      onClick={() => openUrl(entry.url)}
                      className="flex items-center gap-1.5 text-cyan-400 transition hover:text-cyan-300 hover:underline"
                    >
                      <span className="truncate max-w-[180px]">{entry.url}</span>
                      <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                    </button>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>

                {/* 操作 */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onEdit(entry)}
                      className="rounded-md p-1.5 text-slate-500 transition hover:bg-cyan-400/10 hover:text-cyan-300"
                      title="編集"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(entry)}
                      className="rounded-md p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                      title="削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
