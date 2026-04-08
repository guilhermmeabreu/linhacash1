import * as React from 'react';
import { cn } from '@/lib/ui/cn';

interface ContentContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: 'md' | 'lg' | 'xl' | 'content';
}

const widthClasses: Record<NonNullable<ContentContainerProps['width']>, string> = {
  md: 'lc-container-md',
  lg: 'lc-container-lg',
  xl: 'lc-container-xl',
  content: 'lc-container-content',
};

export function ContentContainer({ className, width = 'content', ...props }: ContentContainerProps) {
  return <div className={cn('lc-content-container', widthClasses[width], className)} {...props} />;
}
