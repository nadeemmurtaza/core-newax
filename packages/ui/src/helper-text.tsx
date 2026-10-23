import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export function HelperText({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('nx-helper-text', className)} {...props} />;
}

export function FieldError({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('nx-field-error', className)} role="alert" {...props} />;
}
