import React, { useState } from 'react';
import { Upload, AlertCircle, FileText } from 'lucide-react';
import type { PasswordEntry } from '../../services/keepassImporter';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';

declare global {
  interface Window {
    electron?: {
      ipc: {
        send: (channel: string, args?: unknown) => void;
        invoke: (channel: string, args?: unknown) => Promise<any>;
        on: (channel: string, callback: (event: any, ...args: any[]) => void) => void;
        once: (channel: string, callback: (event: any, ...args: any[]) => void) => void;
      };
    };
  }
}

interface ImportModalProps {
  onSuccess: (entries: PasswordEntry[]) => void;
  onClose: () => void;
}

export function ImportModal({ onSuccess, onClose }: ImportModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFile = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const entries = await window.electron?.ipc.invoke('select-and-import-csv');
      // null means the user canceled the dialog
      if (entries) {
        onSuccess(entries);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import CSV');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>KeePass CSV をインポート</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5">
          {error && (
            <div className="mb-4 flex gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-400" />
              <p className="text-sm text-rose-300">{error}</p>
            </div>
          )}

          <button
            onClick={handleSelectFile}
            disabled={isLoading}
            className="group w-full rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] p-10 text-center transition hover:border-cyan-400/50 hover:bg-cyan-400/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="mx-auto mb-3 h-12 w-12 text-slate-500 transition group-hover:text-cyan-300" />
            <p className="mb-1 font-medium text-slate-200">
              {isLoading ? 'インポート中...' : 'クリックして CSV ファイルを選択'}
            </p>
            <p className="text-sm text-slate-500">
              ファイル選択ダイアログが開きます
            </p>
          </button>

          <div className="mt-5 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-200">
              <FileText className="h-4 w-4" />
              KeePass からのエクスポート方法
            </h3>
            <ol className="list-inside list-decimal space-y-1 text-sm text-slate-400">
              <li>KeePass を開く</li>
              <li>エクスポートするエントリを選択</li>
              <li>ファイル → エクスポート → CSV</li>
              <li>そのファイルをここで選択</li>
            </ol>
          </div>

          <DialogFooter className="mt-5">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSelectFile}
              disabled={isLoading}
              className="flex-1 bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 hover:shadow-[0_8px_30px_-6px_rgba(34,211,238,0.6)] hover:brightness-110"
            >
              {isLoading ? 'インポート中...' : 'ファイルを選択'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
