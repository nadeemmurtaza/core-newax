import { useEffect } from 'react';
import { cn } from './cn';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastContent {
  readonly id: string;
  readonly tone: ToastTone;
  readonly message: string;
  /** Milliseconds before auto-dismiss; omit for a toast that stays until dismissed. */
  readonly durationMs?: number;
}

export interface ToastViewportProps {
  readonly toasts: readonly ToastContent[];
  readonly onDismiss: (id: string) => void;
  readonly className?: string;
}

const TONE_CLASS: Record<ToastTone, string> = {
  info: 'nx-toast-info',
  success: 'nx-toast-success',
  warning: 'nx-toast-warning',
  error: 'nx-toast-error',
};

/** The one toast region the app renders -- it owns the queue (what's in
 * `toasts`), this owns presentation and auto-dismiss timing. */
export function ToastViewport({ toasts, onDismiss, className }: ToastViewportProps) {
  return (
    <div className={cn('nx-toast-viewport', className)} aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({
  toast,
  onDismiss,
}: {
  readonly toast: ToastContent;
  readonly onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    if (toast.durationMs === undefined) {
      return;
    }
    const timer = setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className={cn('nx-toast', TONE_CLASS[toast.tone])}
    >
      <p className="nx-toast-message">{toast.message}</p>
      <button
        type="button"
        className="nx-toast-dismiss"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}
