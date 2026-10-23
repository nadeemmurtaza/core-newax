import { cn } from '@newaxhq/ui';
import type { StatusBannerContent } from './types';

export interface StatusBannerProps {
  readonly banner: StatusBannerContent;
  readonly onDismiss?: () => void;
  readonly className?: string;
}

const TONE_CLASS: Record<StatusBannerContent['tone'], string> = {
  info: 'nx-status-banner-info',
  warning: 'nx-status-banner-warning',
  critical: 'nx-status-banner-critical',
};

/** One global place for maintenance notices, announcements, and
 * connectivity/sync status -- not a per-page concern. */
export function StatusBanner({ banner, onDismiss, className }: StatusBannerProps) {
  return (
    <div
      role={banner.tone === 'critical' ? 'alert' : 'status'}
      className={cn('nx-status-banner', TONE_CLASS[banner.tone], className)}
    >
      <p className="nx-status-banner-message">{banner.message}</p>
      {banner.dismissible && onDismiss ? (
        <button
          type="button"
          className="nx-status-banner-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
