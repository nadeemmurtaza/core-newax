import type { ReactNode } from 'react';
import { cn } from '@newaxhq/ui';

export type PageContainerWidth = 'narrow' | 'default' | 'wide' | 'full';

const WIDTH_CLASS: Record<PageContainerWidth, string> = {
  narrow: 'nx-page-container-narrow',
  default: 'nx-page-container-default',
  wide: 'nx-page-container-wide',
  full: 'nx-page-container-full',
};

export interface PageContainerProps {
  readonly width?: PageContainerWidth;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Content-width mode for the main region -- a form or a focused task
 * wants `narrow`, a table-heavy report wants `wide`/`full`. Separate from
 * AppShell's sidebar slots: a page can be `full` width and still have
 * both sidebars, or `narrow` with none -- the two are independent.
 */
export function PageContainer({ width = 'default', children, className }: PageContainerProps) {
  return <div className={cn('nx-page-container', WIDTH_CLASS[width], className)}>{children}</div>;
}
