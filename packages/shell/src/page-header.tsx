import type { ReactNode } from 'react';
import { cn } from '@newaxhq/ui';

export interface PageHeaderProps {
  readonly breadcrumbs?: ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
  readonly className?: string;
}

/** One title, one primary action slot -- per-page context, not the app
 * identity (that's Header) and not navigation (that's the sidebars/HorizontalNav). */
export function PageHeader({
  breadcrumbs,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('nx-page-header', className)}>
      {breadcrumbs}
      <div className="nx-page-header-row">
        <div className="nx-page-header-text">
          <h1 className="nx-page-header-title">{title}</h1>
          {description ? <p className="nx-page-header-description">{description}</p> : null}
        </div>
        {actions ? <div className="nx-page-header-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
