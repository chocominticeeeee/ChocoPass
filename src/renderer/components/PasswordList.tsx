import React, { useState } from 'react';
import { Globe, Mail, Folder, ChevronDown, ChevronRight } from 'lucide-react';
import type { PasswordEntry } from '../../services/keepassImporter';

interface PasswordListProps {
  entries: PasswordEntry[];
  selectedId?: string;
  onSelect: (entry: PasswordEntry) => void;
}

const UNGROUPED = '未分類';

export function PasswordList({ entries, selectedId, onSelect }: PasswordListProps) {
  // 折りたたまれているグループ名の集合
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  if (entries.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400 text-sm">
        パスワードがありません
      </div>
    );
  }

  // グループごとにエントリをまとめる
  const groups = new Map<string, PasswordEntry[]>();
  for (const entry of entries) {
    const key = entry.group?.trim() || UNGROUPED;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(entry);
  }

  // グループ名をソート（未分類は最後）
  const groupNames = Array.from(groups.keys()).sort((a, b) => {
    if (a === UNGROUPED) return 1;
    if (b === UNGROUPED) return -1;
    return a.localeCompare(b, 'ja');
  });

  const toggle = (name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  return (
    <div>
      {groupNames.map((name) => {
        const items = groups.get(name)!;
        const isCollapsed = collapsed.has(name);
        return (
          <div key={name}>
            <button
              onClick={() => toggle(name)}
              className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 transition text-left sticky top-0"
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
              <Folder className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700 truncate flex-1">
                {name}
              </span>
              <span className="text-xs text-gray-400">{items.length}</span>
            </button>

            {!isCollapsed && (
              <div className="divide-y divide-gray-100">
                {items.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => onSelect(entry)}
                    className={`w-full text-left p-4 pl-6 hover:bg-gray-50 transition ${
                      selectedId === entry.id
                        ? 'bg-blue-50 border-l-4 border-blue-600'
                        : ''
                    }`}
                  >
                    <p className="font-medium text-gray-900 truncate">
                      {entry.title}
                    </p>
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {entry.username}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {entry.url && <Globe className="w-4 h-4 text-gray-400" />}
                      {entry.username.includes('@') && (
                        <Mail className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
