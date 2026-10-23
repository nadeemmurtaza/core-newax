import { cloneElement, isValidElement, useId, type ReactElement } from 'react';
import { cn } from './cn';
import { Label } from './label';

export interface FormFieldProps {
  readonly label: string;
  readonly helperText?: string;
  readonly error?: string;
  readonly required?: boolean;
  /** A single form control (Input/Textarea/Select/Checkbox/Switch) --
   * this wires id/aria-describedby/aria-invalid onto it, so the control
   * and its error/helper text are associated for screen readers without
   * every call site repeating that wiring by hand. */
  readonly children: ReactElement;
  readonly className?: string;
}

export function FormField({
  label,
  helperText,
  error,
  required,
  children,
  className,
}: FormFieldProps) {
  const fieldId = useId();
  const helperId = useId();
  const errorId = useId();
  const describedBy = error ? errorId : helperText ? helperId : undefined;

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: fieldId,
        'aria-describedby': describedBy,
        'aria-invalid': Boolean(error),
        error: Boolean(error),
      })
    : children;

  return (
    <div className={cn('nx-form-field', className)}>
      <Label htmlFor={fieldId}>
        {label}
        {required ? <span className="nx-form-field-required"> *</span> : null}
      </Label>
      {control}
      {error ? (
        <p id={errorId} className="nx-field-error">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="nx-helper-text">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
