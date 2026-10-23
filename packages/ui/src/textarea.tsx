import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

export function textareaClassName(hasError: boolean, className?: string): string {
  return cn('nx-textarea', hasError && 'nx-textarea-error', className);
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error = false, className, ...props }, ref) => (
    <textarea ref={ref} className={textareaClassName(error, className)} {...props} />
  ),
);

Textarea.displayName = 'Textarea';
