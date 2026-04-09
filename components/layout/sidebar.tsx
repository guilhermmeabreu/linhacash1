import * as React from 'react';
import Link from 'next/link';
import { BarChart3, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/ui/cn';

export interface SidebarItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
}

interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  items?: SidebarItem[];
  activeKey?: string;
  footer?: React.ReactNode;
}

export function Sidebar({ className, items = [], activeKey, footer, ...props }: SidebarProps) {
  return (
    <nav className={cn('lc-sidebar', className)} {...props}>
      <Link href="/" className="lc-sidebar-brand" aria-label="LinhaCash">
        <span className="lc-sidebar-brand-icon"><BarChart3 size={16} /></span>
        <span className="lc-sidebar-brand-text">Linha<span>Cash</span></span>
      </Link>

      <div className="lc-sidebar-nav">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.key === activeKey;

          if (item.disabled) {
            return (
              <span key={item.key} className={cn('lc-sidebar-item', 'is-disabled')} aria-disabled="true">
                <span className="lc-sidebar-item-main">
                  <Icon size={16} aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
                <span className="lc-sidebar-badge">EM BREVE</span>
              </span>
            );
          }

          return (
            <Link key={item.key} href={item.href} className={cn('lc-sidebar-item', active && 'is-active')}>
              <Icon size={16} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {footer ? <div className="lc-sidebar-footer">{footer}</div> : null}
    </nav>
  );
}
