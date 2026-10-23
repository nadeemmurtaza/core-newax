import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

/** Resolves an Input's class list. Exported so the error-state mapping is unit-testable without rendering. */
export function inputClassName(hasError: boolean, className?: string): string {
  return cn('nx-input', hasError && 'nx-input-error', className);
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error = false, className, ...props }, ref) => (
    <input ref={ref} className={inputClassName(error, className)} {...props} />
  ),
);

Input.displayName = 'Input';
