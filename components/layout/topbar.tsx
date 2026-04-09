import * as React from 'react';
import { cn } from '@/lib/ui/cn';

interface TopBarProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  context?: React.ReactNode;
  actions?: React.ReactNode;
}

export function TopBar({ className, title, context, actions, children, ...props }: TopBarProps) {
  return (
    <div className={cn('lc-topbar', className)} {...props}>
      <div className="lc-topbar-context">
        {title ? <p className="lc-topbar-title">{title}</p> : null}
        {context ? <div className="lc-topbar-subtitle">{context}</div> : null}
      </div>

      {children}
      {actions ? <div className="lc-topbar-actions">{actions}</div> : null}
    </div>
  );
}
