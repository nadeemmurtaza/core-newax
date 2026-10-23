import { cn } from './cn';

export function switchClassName(checked: boolean, className?: string): string {
  return cn('nx-switch', checked && 'nx-switch-checked', className);
}

export interface SwitchProps {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly 'aria-label'?: string;
  readonly 'aria-labelledby'?: string;
  readonly className?: string;
}

/** A `role="switch"` button, not a styled checkbox -- checkbox semantics
 * ("checked") don't match the "on/off" interaction a switch communicates,
 * and `role="switch"` on an `<input type="checkbox">` has inconsistent
 * screen-reader support across browsers. */
export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  className,
  ...ariaProps
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={switchClassName(checked, className)}
      onClick={() => onCheckedChange(!checked)}
      {...ariaProps}
    >
      <span className="nx-switch-thumb" aria-hidden="true" />
    </button>
  );
}
