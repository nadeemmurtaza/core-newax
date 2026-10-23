import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('nx-skeleton', className)} aria-hidden="true" {...props} />;
}
