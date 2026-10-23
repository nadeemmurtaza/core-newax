import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'nx-badge-neutral',
  info: 'nx-badge-info',
  success: 'nx-badge-success',
  warning: 'nx-badge-warning',
  danger: 'nx-badge-danger',
};

export function badgeClassName(tone: BadgeTone = 'neutral', className?: string): string {
  return cn('nx-badge', TONE_CLASS[tone], className);
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return <span className={badgeClassName(tone, className)} {...props} />;
}
