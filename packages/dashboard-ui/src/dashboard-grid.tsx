import type { ReactNode } from 'react';
import { cn } from '@newaxhq/ui';

export interface DashboardGridProps {
  readonly className?: string;
  readonly children: ReactNode;
}

/** The grid shell every service's dashboard renders widgets into. Density
 * changes per tier via CSS; the widget order/composition stays the same
 * (seven-tier responsive rule: density changes, not information architecture). */
export function DashboardGrid({ className, children }: DashboardGridProps) {
  return <div className={cn('nx-dashboard-grid', className)}>{children}</div>;
}
