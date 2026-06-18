import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind クラスを条件付きで結合し、衝突を解決する（shadcn 標準ヘルパー） */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
