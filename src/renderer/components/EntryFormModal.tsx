import React, { useState } from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import type { PasswordEntry } from '../../services/keepassImporter';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Button } from './ui/button';

interface EntryFormModalProps {
  /** 編集対象のエントリ。未指定なら新規作成 */
  entry?: PasswordEntry;
  onSave: (entry: PasswordEntry) => void;
  onClose: () => void;
  /** エントリを削除（編集時のみ） */
  onDelete?: (id: string) => void;
}

export function EntryFormModal({ entry, onSave, onClose, onDelete }: EntryFormModalProps) {
  const isEdit = !!entry;
  const [title, setTitle] = useState(entry?.title ?? '');
  const [username, setUsername] = useState(entry?.username ?? '');
  const [password, setPassword] = useState(entry?.password ?? '');
  const [url, setUrl] = useState(entry?.url ?? '');
  const [group, setGroup] = useState(entry?.group ?? '');
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const generatePassword = () => {
    const charset =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
    const length = 16;
    const values = new Uint32Array(length);
    crypto.getRandomValues(values);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset[values[i] % charset.length];
    }
    setPassword(result);
  };

  const handleDelete = () => {
    if (!entry || !onDelete) return;
    if (window.confirm(`「${entry.title}」を削除しますか？`)) {
      onDelete(entry.id);
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }

    const saved: PasswordEntry = {
      id: entry?.id ?? `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: title.trim(),
      username,
      password,
      url,
      group,
      notes,
    };

    onSave(saved);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'エントリを編集' : '新規エントリ'}</DialogTitle>
          </DialogHeader>

          <div className="max-h-[65vh] space-y-4 overflow-y-auto px-6 py-5">
            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
                <p className="text-sm text-rose-300">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="entry-title">
                タイトル <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="entry-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="entry-username">ユーザー名</Label>
              <Input
                id="entry-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="entry-password">パスワード</Label>
              <div className="flex gap-2">
                <Input
                  id="entry-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generatePassword}
                  className="whitespace-nowrap border-cyan-400/30 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20 hover:text-cyan-200"
                >
                  <Sparkles className="h-4 w-4" />
                  自動生成
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="entry-url">ウェブサイト</Label>
              <Input
                id="entry-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="entry-group">グループ</Label>
              <Input
                id="entry-group"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                placeholder="例: 仕事/メール"
              />
              <p className="text-xs text-slate-500">
                「/」で区切るとサブフォルダになります（例: 仕事/メール）
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="entry-notes">メモ</Label>
              <Textarea
                id="entry-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-24 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-white/10 px-6 py-5">
            {isEdit && onDelete && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                title="削除"
                className="border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 sm:mr-auto"
              >
                <Trash2 className="h-4 w-4" />
                削除
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
              キャンセル
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 hover:shadow-[0_8px_30px_-6px_rgba(34,211,238,0.6)] hover:brightness-110 sm:flex-none"
            >
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
