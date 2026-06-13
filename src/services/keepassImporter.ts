import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

export interface PasswordEntry {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  group?: string;
}

export async function importKeePassCSV(filePath: string): Promise<PasswordEntry[]> {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });

    const entries: PasswordEntry[] = records.map((record: any, index: number) => {
      // ヘッダー名のゆらぎに対応するため、大文字小文字を無視して引けるようにする
      const lookup = (...keys: string[]): string => {
        for (const key of keys) {
          for (const field of Object.keys(record)) {
            if (field.trim().toLowerCase() === key.toLowerCase()) {
              return record[field] ?? '';
            }
          }
        }
        return '';
      };

      // KeePassの「Group Tree」(親フォルダのパス) と「Group」(末端フォルダ名) を
      // "/" 区切りの1つの階層パスに統合する。バックスラッシュ区切りも吸収する。
      const groupParts = [lookup('Group Tree'), lookup('Group')]
        .flatMap((s) => s.replace(/\\/g, '/').split('/'))
        .map((s) => s.trim())
        .filter(Boolean);

      return {
        id: `entry-${Date.now()}-${index}`,
        title: lookup('Title', 'Name', 'Account'),
        username: lookup('UserName', 'Username', 'Login', 'Login Name', 'User Name'),
        password: lookup('Password'),
        url: lookup('URL', 'Url', 'Web Site', 'Website', 'Web Site URL'),
        notes: lookup('Notes', 'Comments', 'Comment'),
        group: groupParts.join('/'),
      };
    });

    return entries;
  } catch (error) {
    console.error('Error importing KeePass CSV:', error);
    throw new Error(`Failed to import KeePass CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function validateKeePassCSV(filePath: string): boolean {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.csv') {
      throw new Error('File must be a CSV file');
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    if (!fileContent) {
      throw new Error('CSV file is empty');
    }

    return true;
  } catch (error) {
    console.error('CSV validation failed:', error);
    return false;
  }
}
