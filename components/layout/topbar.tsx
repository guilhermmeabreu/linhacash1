import * as React from 'react';
import { cn } from '@/lib/ui/cn';

export function TopBar({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <div className={cn('lc-topbar', className)} {...props} />;
}
