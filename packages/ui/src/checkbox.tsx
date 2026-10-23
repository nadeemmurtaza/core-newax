import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export function checkboxClassName(className?: string): string {
  return cn('nx-checkbox', className);
}

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <input ref={ref} type="checkbox" className={checkboxClassName(className)} {...props} />
  ),
);

Checkbox.displayName = 'Checkbox';
