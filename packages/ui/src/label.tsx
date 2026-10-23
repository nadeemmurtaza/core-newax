import type { LabelHTMLAttributes } from 'react';
import { cn } from './cn';

export function labelClassName(className?: string): string {
  return cn('nx-label', className);
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={labelClassName(className)} {...props} />;
}
