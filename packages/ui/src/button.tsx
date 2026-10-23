import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'nx-btn-primary',
  secondary: 'nx-btn-secondary',
  ghost: 'nx-btn-ghost',
  destructive: 'nx-btn-destructive',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'nx-btn-sm',
  md: 'nx-btn-md',
  lg: 'nx-btn-lg',
};

/** Resolves a Button's class list. Exported so variant/size mapping is unit-testable without rendering. */
export function buttonClassName(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn('nx-btn', VARIANT_CLASS[variant], SIZE_CLASS[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...props }, ref) => (
    <button ref={ref} className={buttonClassName(variant, size, className)} {...props} />
  ),
);

Button.displayName = 'Button';
