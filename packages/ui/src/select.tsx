import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from './cn';

export function selectClassName(hasError: boolean, className?: string): string {
  return cn('nx-select', hasError && 'nx-select-error', className);
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

/** A native `<select>`, deliberately -- correct keyboard/screen-reader/
 * mobile behavior for free. Combobox/Autocomplete (filterable, custom
 * popover) is a separate Phase 2 component, not this one with options. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error = false, className, ...props }, ref) => (
    <select ref={ref} className={selectClassName(error, className)} {...props} />
  ),
);

Select.displayName = 'Select';
