import { cn } from '@newaxhq/ui';

export interface SearchTriggerProps {
  readonly onActivate: () => void;
  readonly className?: string;
}

/** Entry point only -- the actual search UI/results belong to the app
 * (or a future dedicated search package), this just opens it. */
export function SearchTrigger({ onActivate, className }: SearchTriggerProps) {
  return (
    <button
      type="button"
      className={cn('nx-header-trigger nx-search-trigger', className)}
      onClick={onActivate}
      aria-label="Search"
    >
      Search
    </button>
  );
}

export interface NotificationsTriggerProps {
  readonly unreadCount: number;
  readonly onActivate: () => void;
  readonly className?: string;
}

export function NotificationsTrigger({
  unreadCount,
  onActivate,
  className,
}: NotificationsTriggerProps) {
  return (
    <button
      type="button"
      className={cn('nx-header-trigger nx-notifications-trigger', className)}
      onClick={onActivate}
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
    >
      Notifications
      {unreadCount > 0 ? <span className="nx-notifications-badge">{unreadCount}</span> : null}
    </button>
  );
}

export interface HelpTriggerProps {
  readonly href: string;
  readonly className?: string;
}

export function HelpTrigger({ href, className }: HelpTriggerProps) {
  return (
    <a href={href} className={cn('nx-header-trigger nx-help-trigger', className)} aria-label="Help">
      Help
    </a>
  );
}
