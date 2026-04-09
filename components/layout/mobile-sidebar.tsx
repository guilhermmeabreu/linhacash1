import * as React from 'react';
import { Sidebar, SidebarItem } from './sidebar';

interface MobileSidebarProps extends React.HTMLAttributes<HTMLElement> {
  items?: SidebarItem[];
  activeKey?: string;
  footer?: React.ReactNode;
}

export function MobileSidebar({ items = [], activeKey, footer, ...props }: MobileSidebarProps) {
  return <Sidebar className="lc-mobile-sidebar" items={items} activeKey={activeKey} footer={footer} {...props} />;
}
