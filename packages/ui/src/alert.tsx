import type { ReactNode } from 'react';
import { cn } from './cn';

export type AlertTone = 'info' | 'success' | 'warning' | 'error';

const TONE_CLASS: Record<AlertTone, string> = {
  info: 'nx-alert-info',
  success: 'nx-alert-success',
  warning: 'nx-alert-warning',
  error: 'nx-alert-error',
};

export function alertClassName(tone: AlertTone = 'info', className?: string): string {
  return cn('nx-alert', TONE_CLASS[tone], className);
}

export interface AlertProps {
  readonly tone?: AlertTone;
  readonly title?: string;
  readonly children: ReactNode;
  readonly className?: string;
}

export function Alert({ tone = 'info', title, children, className }: AlertProps) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={alertClassName(tone, className)}>
      {title ? <p className="nx-alert-title">{title}</p> : null}
      <div className="nx-alert-body">{children}</div>
    </div>
  );
}
