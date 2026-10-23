import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export function datePickerClassName(hasError: boolean, className?: string): string {
  return cn('nx-date-picker', hasError && 'nx-date-picker-error', className);
}

export type DatePickerProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  error?: boolean;
};

/** A native `<input type="date">` -- the OS/browser's own date picker UI,
 * which is more accessible and better internationalized than a custom
 * calendar grid. DateRangePicker composes two of these, not a shared
 * custom calendar implementation. */
export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ error = false, className, ...props }, ref) => (
    <input ref={ref} type="date" className={datePickerClassName(error, className)} {...props} />
  ),
);

DatePicker.displayName = 'DatePicker';

export interface DateRangePickerProps {
  readonly startProps: Omit<DatePickerProps, 'error'>;
  readonly endProps: Omit<DatePickerProps, 'error'>;
  readonly error?: boolean;
  readonly className?: string;
}

export function DateRangePicker({
  startProps,
  endProps,
  error = false,
  className,
}: DateRangePickerProps) {
  return (
    <div className={cn('nx-date-range-picker', className)}>
      <DatePicker
        {...startProps}
        error={error}
        aria-label={startProps['aria-label'] ?? 'Start date'}
      />
      <span className="nx-date-range-separator" aria-hidden="true">
        &ndash;
      </span>
      <DatePicker {...endProps} error={error} aria-label={endProps['aria-label'] ?? 'End date'} />
    </div>
  );
}
