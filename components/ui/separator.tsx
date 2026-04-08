import * as React from 'react';
import { cn } from '@/lib/ui/cn';

export function Separator({ className, ...props }: React.HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn('lc-separator', className)} {...props} />;
}
