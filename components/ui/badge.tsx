import * as React from 'react';
import { cn } from '@/lib/ui/cn';

type BadgeVariant = 'default' | 'success' | 'muted' | 'danger';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'lc-badge-default',
  success: 'lc-badge-success',
  muted: 'lc-badge-muted',
  danger: 'lc-badge-danger',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return <span className={cn('lc-badge', variantClasses[variant], className)} {...props} />;
}
