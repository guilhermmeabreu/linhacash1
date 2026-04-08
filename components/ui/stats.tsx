import * as React from 'react';
import { cn } from '@/lib/ui/cn';

export function StatItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('lc-stat-item', className)} {...props} />;
}

export function StatLabel({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('lc-stat-label', className)} {...props} />;
}

export function StatValue({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('lc-stat-value', className)} {...props} />;
}
