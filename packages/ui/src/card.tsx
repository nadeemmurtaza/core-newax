import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export function cardClassName(className?: string): string {
  return cn('nx-card', className);
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cardClassName(className)} {...props} />;
}
