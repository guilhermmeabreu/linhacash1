import * as React from 'react';
import { cn } from '@/lib/ui/cn';

interface AppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  sidebar?: React.ReactNode;
  topbar?: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({ className, sidebar, topbar, children, ...props }: AppShellProps) {
  return (
    <div className={cn('lc-shell', className)} {...props}>
      {sidebar ? <aside className="lc-shell-sidebar">{sidebar}</aside> : null}
      <div className="lc-shell-main">
        {topbar ? <header className="lc-shell-topbar">{topbar}</header> : null}
        <div className="lc-shell-content">{children}</div>
      </div>
    </div>
  );
}
