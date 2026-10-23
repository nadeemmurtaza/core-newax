import type { ReactNode } from 'react';
import { cn } from '@newaxhq/ui';
import { SkipLink } from './skip-link';

export interface AppShellProps {
  readonly skipLinkTargetId?: string;
  readonly statusBanners?: ReactNode;
  readonly header: ReactNode;
  readonly horizontalNav?: ReactNode;
  readonly primarySidebar?: ReactNode;
  readonly secondarySidebar?: ReactNode;
  readonly mobileNavDrawer?: ReactNode;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * The root frame. Every region is a slot the host app fills with this
 * package's own components (Header, HorizontalNav, Sidebar x2, Footer,
 * StatusBanner, MobileNavDrawer) or omits entirely -- a focused task view
 * can render AppShell with no sidebars at all, same component either way.
 */
export function AppShell({
  skipLinkTargetId = 'main-content',
  statusBanners,
  header,
  horizontalNav,
  primarySidebar,
  secondarySidebar,
  mobileNavDrawer,
  footer,
  children,
  className,
}: AppShellProps) {
  return (
    <div className={cn('nx-app-shell', className)}>
      <SkipLink targetId={skipLinkTargetId} />
      {statusBanners}
      {header}
      {horizontalNav}
      <div className="nx-app-shell-body">
        {primarySidebar}
        {secondarySidebar}
        <main id={skipLinkTargetId} className="nx-app-shell-main">
          {children}
        </main>
      </div>
      {footer}
      {mobileNavDrawer}
    </div>
  );
}
