import * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { cn } from '../../lib/utils';

/**
 * shadcn 風の ToggleGroup（Radix ベース）。
 * テーマ切替などの「いくつかの中から1つ選ぶ」UIに使う。
 * 本アプリのグラス/ネオン系クラスで装飾している。
 */

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn(
      'inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1',
      className
    )}
    {...props}
  >
    {children}
  </ToggleGroupPrimitive.Root>
));
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(
      'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition',
      'cursor-pointer text-slate-400 hover:text-white',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
      'data-[state=on]:bg-gradient-to-r data-[state=on]:from-cyan-400 data-[state=on]:to-violet-500 data-[state=on]:text-slate-950',
      className
    )}
    {...props}
  >
    {children}
  </ToggleGroupPrimitive.Item>
));
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
