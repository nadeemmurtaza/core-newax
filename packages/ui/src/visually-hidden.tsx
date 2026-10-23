import type { HTMLAttributes } from 'react';
import { cn } from './cn';

/** Content present for screen readers/assistive tech, removed from
 * visual layout -- not `display: none` (which removes it from both). */
export function VisuallyHidden({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('nx-visually-hidden', className)} {...props} />;
}
