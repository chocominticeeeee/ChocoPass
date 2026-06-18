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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './ui/table';
import { Button } from './ui/button';

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

  // 行内の小さなアイコンボタン（Button の icon サイズを表内向けに縮める）
  const iconBtn =
    'h-auto w-auto rounded-md p-1.5 text-slate-500 hover:bg-white/10 hover:text-cyan-300';

  return (
    <div className="flex-1 overflow-auto px-4 py-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>タイトル</TableHead>
            <TableHead>ユーザー名</TableHead>
            <TableHead>パスワード</TableHead>
            <TableHead>ウェブサイト</TableHead>
            <TableHead>メモ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const isVisible = visible.has(entry.id);
            return (
              <TableRow
                key={entry.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(MIME_ENTRY, entry.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                className="group cursor-grab [&>td]:bg-white/[0.03] [&>td]:transition hover:[&>td]:bg-white/[0.07] active:cursor-grabbing [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl [&>td]:border-y [&>td]:border-white/5 [&>td:first-child]:border-l [&>td:last-child]:border-r"
              >
                {/* タイトル（ダブルクリックで編集） */}
                <TableCell
                  className="cursor-pointer select-none font-medium text-white"
                  onDoubleClick={() => onEdit(entry)}
                  title="ダブルクリックで編集"
                >
                  <div className="flex items-center gap-2.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(entry.id);
                      }}
                      onDoubleClick={(e) => e.stopPropagation()}
                      className={`h-auto w-auto shrink-0 rounded-md p-1 ${
                        entry.favorite
                          ? 'text-amber-400 hover:bg-transparent hover:text-amber-300'
                          : 'text-slate-600 hover:bg-white/10 hover:text-amber-300'
                      }`}
                      title={entry.favorite ? 'お気に入りを解除' : 'お気に入りに登録'}
                    >
                      <Star
                        className="h-4 w-4"
                        fill={entry.favorite ? 'currentColor' : 'none'}
                      />
                    </Button>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400/20 to-violet-500/20 text-xs font-bold uppercase text-cyan-300 ring-1 ring-inset ring-white/10">
                      {entry.title.slice(0, 1) || '?'}
                    </span>
                    <span className="truncate">{entry.title}</span>
                  </div>
                </TableCell>

                {/* ユーザー名 */}
                <TableCell className="text-slate-300">
                  {entry.username ? (
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[180px]">
                        {entry.username}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copy(entry.username, `${entry.id}:user`)}
                        className={iconBtn}
                        title="コピー"
                      >
                        {copiedKey === `${entry.id}:user` ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </TableCell>

                {/* パスワード */}
                <TableCell className="text-slate-300">
                  {entry.password ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono truncate max-w-[160px] tracking-tight">
                        {isVisible ? entry.password : '••••••••'}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleVisible(entry.id)}
                        className={iconBtn}
                        title={isVisible ? '隠す' : '表示'}
                      >
                        {isVisible ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copy(entry.password, `${entry.id}:pass`)}
                        className={iconBtn}
                        title="コピー"
                      >
                        {copiedKey === `${entry.id}:pass` ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </TableCell>

                {/* ウェブサイト */}
                <TableCell>
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
                </TableCell>

                {/* メモ */}
                <TableCell className="text-slate-400">
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
