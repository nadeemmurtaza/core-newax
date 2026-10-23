import { Suspense, type ReactNode } from 'react';
import { cn } from '@newaxhq/ui';

export interface ShellLoadingBoundaryProps {
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
  readonly className?: string;
}

/** The app-wide loading fallback for whatever's suspended inside AppShell's
 * children (lazy routes, data-fetching). A thin Suspense wrapper with the
 * shell's own default spinner, so every app doesn't restyle its own. */
export function ShellLoadingBoundary({ children, fallback, className }: ShellLoadingBoundaryProps) {
  return (
    <Suspense
      fallback={
        fallback ?? (
          <div className={cn('nx-shell-loading-boundary', className)} aria-busy="true">
            <span className="nx-shell-loading-spinner" aria-hidden="true" />
          </div>
        )
      }
    >
      {children}
    </Suspense>
  );
}
