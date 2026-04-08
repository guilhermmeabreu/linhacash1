import * as React from 'react';
import { cn } from '@/lib/ui/cn';

interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}

export function SectionHeader({ className, title, subtitle, actions, ...props }: SectionHeaderProps) {
  return (
    <div className={cn('lc-section-header', className)} {...props}>
      <div>
        <h2 className="lc-section-title">{title}</h2>
        {subtitle ? <p className="lc-section-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="lc-section-actions">{actions}</div> : null}
    </div>
  );
}
