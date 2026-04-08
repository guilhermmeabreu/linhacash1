import * as React from 'react';
import { cn } from '@/lib/ui/cn';

export function PageSection({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn('lc-page-section', className)} {...props} />;
}
