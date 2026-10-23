import { cn } from '@newaxhq/ui';
import type { UserMenuAction, UserProfile } from './types';

export interface UserMenuProps {
  readonly profile: UserProfile;
  readonly actions: readonly UserMenuAction[];
  readonly className?: string;
}

export function UserMenu({ profile, actions, className }: UserMenuProps) {
  return (
    <details className={cn('nx-user-menu', className)}>
      <summary
        className="nx-user-menu-trigger"
        aria-label={`Account menu for ${profile.displayName}`}
      >
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt="" className="nx-user-menu-avatar" />
        ) : (
          <span className="nx-user-menu-avatar-fallback" aria-hidden="true">
            {profile.displayName.charAt(0).toUpperCase()}
          </span>
        )}
      </summary>
      <div className="nx-user-menu-panel">
        <div className="nx-user-menu-identity">
          <p className="nx-user-menu-name">{profile.displayName}</p>
          {profile.email ? <p className="nx-user-menu-email">{profile.email}</p> : null}
        </div>
        <ul className="nx-user-menu-actions">
          {actions.map((action) => (
            <li key={action.id}>
              {action.href ? (
                <a
                  href={action.href}
                  className={cn(
                    'nx-user-menu-action',
                    action.destructive && 'nx-user-menu-action-destructive',
                  )}
                >
                  {action.label}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={action.onSelect}
                  className={cn(
                    'nx-user-menu-action',
                    action.destructive && 'nx-user-menu-action-destructive',
                  )}
                >
                  {action.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
