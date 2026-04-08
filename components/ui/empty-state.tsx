import * as React from 'react';
import { cn } from '@/lib/ui/cn';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ className, title, description, action, ...props }: EmptyStateProps) {
  return (
    <div className={cn('lc-empty-state', className)} {...props}>
      <h3 className="lc-empty-title">{title}</h3>
      {description ? <p className="lc-empty-description">{description}</p> : null}
      {action ? <div className="lc-empty-action">{action}</div> : null}
    </div>
  );
}
