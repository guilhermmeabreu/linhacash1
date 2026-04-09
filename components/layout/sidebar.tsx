import * as React from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/ui/cn';
import { LinhaCashLogo } from './linhacash-logo';

export interface SidebarItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
  secondary?: boolean;
}

interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  items?: SidebarItem[];
  activeKey?: string;
  footer?: React.ReactNode;
  onItemClick?: (item: SidebarItem) => void;
}

export function Sidebar({ className, items = [], activeKey, footer, onItemClick, ...props }: SidebarProps) {
  return (
    <nav className={cn('lc-sidebar', className)} {...props}>
      <LinhaCashLogo href="/app" className="lc-sidebar-brand" ariaLabel="LinhaCash dashboard" />

      <div className="lc-sidebar-nav">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.key === activeKey;

          if (item.disabled) {
            return (
              <span key={item.key} className={cn('lc-sidebar-item', item.secondary && 'is-secondary', 'is-disabled')} aria-disabled="true">
                <span className="lc-sidebar-item-main">
                  <Icon size={16} aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
                <span className="lc-sidebar-item-meta">
                  <span className="lc-sidebar-badge">EM BREVE</span>
                </span>
              </span>
            );
          }

          return (
            <Link key={item.key} href={item.href} className={cn('lc-sidebar-item', item.secondary && 'is-secondary', active && 'is-active')} onClick={() => onItemClick?.(item)}>
              <span className="lc-sidebar-item-main">
                <Icon size={16} aria-hidden="true" />
                <span>{item.label}</span>
              </span>
              <span className="lc-sidebar-item-meta" aria-hidden="true" />
            </Link>
          );
        })}
      </div>

      {footer ? <div className="lc-sidebar-footer">{footer}</div> : null}
    </nav>
  );
}
