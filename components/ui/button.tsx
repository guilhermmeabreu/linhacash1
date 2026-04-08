import * as React from 'react';
import { cn } from '@/lib/ui/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'lc-btn-primary',
  secondary: 'lc-btn-secondary',
  ghost: 'lc-btn-ghost',
  danger: 'lc-btn-danger',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'lc-btn-sm',
  md: 'lc-btn-md',
  lg: 'lc-btn-lg',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn('lc-btn', variantClasses[variant], sizeClasses[size], className)} {...props} />;
});
