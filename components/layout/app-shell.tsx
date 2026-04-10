'use client';

import * as React from 'react';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/ui/cn';

interface AppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  sidebar?: React.ReactNode;
  mobileSidebar?: React.ReactNode;
  topbar?: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({ className, sidebar, mobileSidebar, topbar, children, ...props }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const toggleMobileSidebar = React.useCallback(() => {
    setMobileOpen((open) => !open);
  }, []);

  const closeMobileSidebar = React.useCallback(() => {
    setMobileOpen(false);
  }, []);

  return (
    <div className={cn('lc-shell', className)} data-mobile-open={mobileOpen ? 'true' : 'false'} {...props}>
      {sidebar ? <aside className="lc-shell-sidebar">{sidebar}</aside> : null}

      {mobileSidebar ? (
        <>
          <button
            type="button"
            className={cn('lc-mobile-overlay', mobileOpen && 'is-open')}
            aria-label="Fechar menu"
            onClick={closeMobileSidebar}
          />
          <aside className={cn('lc-mobile-drawer', mobileOpen && 'is-open')}>
            <div onClickCapture={(event) => {
              const target = event.target as HTMLElement | null;
              if (target?.closest('a[href]')) {
                closeMobileSidebar();
              }
            }}>
            {mobileSidebar}
            </div>
          </aside>
        </>
      ) : null}

      <div className="lc-shell-main">
        {topbar ? (
          <header className="lc-shell-topbar">
            <button type="button" className="lc-mobile-menu-btn" onClick={toggleMobileSidebar} aria-label="Abrir menu">
              <Menu size={18} />
            </button>
            {topbar}
          </header>
        ) : null}
        <div className="lc-shell-content">{children}</div>
      </div>
    </div>
  );
}
