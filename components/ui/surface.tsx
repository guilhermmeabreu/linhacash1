import * as React from 'react';
import { cn } from '@/lib/ui/cn';

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export function Surface({ className, elevated = false, ...props }: SurfaceProps) {
  return <div className={cn('lc-surface', elevated && 'lc-surface-elevated', className)} {...props} />;
}
