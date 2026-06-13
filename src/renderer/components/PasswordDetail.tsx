import React, { useState } from 'react';
import { Copy, Eye, EyeOff, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import type { PasswordEntry } from '../../services/keepassImporter';

interface PasswordDetailProps {
  entry: PasswordEntry;
  onEdit: (entry: PasswordEntry) => void;
  onDelete: (id: string) => void;
}

export function PasswordDetail({ entry, onEdit, onDelete }: PasswordDetailProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDelete = () => {
    if (window.confirm(`「${entry.title}」を削除しますか？`)) {
      onDelete(entry.id);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-8">
        <div className="flex items-start justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{entry.title}</h1>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => onEdit(entry)}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              <Pencil className="w-4 h-4" />
              編集
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-2 px-3 py-2 border border-red-300 rounded-lg text-red-600 hover:bg-red-50 transition"
            >
              <Trash2 className="w-4 h-4" />
              削除
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* ユーザー名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ユーザー名
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={entry.username}
                readOnly
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
              />
              <button
                onClick={() => copyToClipboard(entry.username, 'username')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                title="ユーザー名をコピー"
              >
                <Copy
                  className={`w-5 h-5 ${
                    copiedField === 'username' ? 'text-green-600' : 'text-gray-600'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* パスワード */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              パスワード
            </label>
            <div className="flex items-center gap-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={entry.password}
                readOnly
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                title={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5 text-gray-600" />
                ) : (
                  <Eye className="w-5 h-5 text-gray-600" />
                )}
              </button>
              <button
                onClick={() => copyToClipboard(entry.password, 'password')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                title="パスワードをコピー"
              >
                <Copy
                  className={`w-5 h-5 ${
                    copiedField === 'password' ? 'text-green-600' : 'text-gray-600'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* ウェブサイト */}
          {entry.url && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ウェブサイト
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={entry.url}
                  readOnly
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 truncate"
                />
                <button
                  onClick={() => copyToClipboard(entry.url, 'url')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                  title="URLをコピー"
                >
                  <Copy
                    className={`w-5 h-5 ${
                      copiedField === 'url' ? 'text-green-600' : 'text-gray-600'
                    }`}
                  />
                </button>
                <a
                  href={entry.url.startsWith('http') ? entry.url : `https://${entry.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                  title="ブラウザで開く"
                >
                  <ExternalLink className="w-5 h-5 text-gray-600" />
                </a>
              </div>
            </div>
          )}

          {/* グループ */}
          {entry.group && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                グループ
              </label>
              <input
                type="text"
                value={entry.group}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
              />
            </div>
          )}

          {/* メモ */}
          {entry.notes && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                メモ
              </label>
              <textarea
                value={entry.notes}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 h-24 resize-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
