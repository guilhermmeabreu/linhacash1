import * as React from 'react';
import { cn } from '@/lib/ui/cn';

export function Sidebar({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <nav className={cn('lc-sidebar', className)} {...props} />;
}
