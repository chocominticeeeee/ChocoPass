import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * shadcn 風の Button。既定の shadcn テーマ変数の代わりに、
 * 本アプリのグラス/ネオン系クラスで装飾している。
 */

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'ghost';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

const variantClasses: Record<ButtonVariant, string> = {
  default:
    'bg-gradient-to-r from-violet-500 to-indigo-600 text-white hover:shadow-[0_8px_30px_-6px_rgba(99,102,241,0.6)] hover:brightness-110',
  destructive:
    'bg-gradient-to-r from-rose-500 to-rose-600 text-white hover:shadow-[0_8px_30px_-6px_rgba(244,63,94,0.6)] hover:brightness-110',
  outline:
    'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white',
  ghost: 'text-slate-300 hover:bg-white/10 hover:text-white',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-10 px-4 py-2.5',
  sm: 'h-9 px-3',
  lg: 'h-11 px-6',
  icon: 'h-10 w-10',
};

/** クラス名のみを生成するヘルパー（asChild 連携や AlertDialog の Action/Cancel で利用） */
export function buttonVariants({
  variant = 'default',
  size = 'default',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold cursor-pointer',
    'transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
    'disabled:pointer-events-none disabled:opacity-50',
    variantClasses[variant],
    sizeClasses[size],
    className
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const classes = buttonVariants({ variant, size, className });
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        className: cn(classes, child.props.className),
      });
    }
    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button };
