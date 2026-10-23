import type { ReactNode } from 'react';
import { cn } from '@newaxhq/ui';
import type { AppIdentity } from './types';

export interface HeaderProps {
  readonly application: AppIdentity;
  /** @newaxhq/shell's Switcher for app/workspace, when the host has more than one option. */
  readonly appSwitcher?: ReactNode;
  readonly workspaceSwitcher?: ReactNode;
  /** SearchTrigger / NotificationsTrigger / HelpTrigger, in the order the app wants them. */
  readonly triggers?: ReactNode;
  /** UserMenu. */
  readonly userMenu?: ReactNode;
  readonly className?: string;
}

/** The global header. Logo/home on the left, switchers next to it,
 * triggers and the user menu on the right. Page title lives in
 * PageHeader, not here -- the header identifies the app, not the page. */
export function Header({
  application,
  appSwitcher,
  workspaceSwitcher,
  triggers,
  userMenu,
  className,
}: HeaderProps) {
  return (
    <header className={cn('nx-header', className)}>
      <div className="nx-header-start">
        <a href={application.homeHref} className="nx-header-brand" aria-label={application.name}>
          {application.logo}
          <span className="nx-header-brand-name">{application.name}</span>
        </a>
        {appSwitcher}
        {workspaceSwitcher}
      </div>
      <div className="nx-header-end">
        {triggers}
        {userMenu}
      </div>
    </header>
  );
}
