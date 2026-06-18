import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * shadcn 風の Input。既定の shadcn テーマ変数の代わりに、
 * 本アプリのグラス/ネオン系クラスで装飾している。
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-3 text-sm text-slate-200',
          'placeholder:text-slate-500 transition',
          'focus:border-cyan-400/50 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
