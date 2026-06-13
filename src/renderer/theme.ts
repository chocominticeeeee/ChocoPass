export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'chocopass-theme';

/** 保存済みテーマを取得（既定はダーク） */
export function getStoredTheme(): Theme {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' ? 'light' : 'dark';
}

/** テーマを <html> クラスに適用して保存する */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  localStorage.setItem(STORAGE_KEY, theme);
}
