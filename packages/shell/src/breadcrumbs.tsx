import { cn } from '@newaxhq/ui';
import { collapseBreadcrumbs } from './breadcrumb-collapse';
import type { BreadcrumbItem } from './types';

export interface BreadcrumbsProps {
  readonly items: readonly BreadcrumbItem[];
  readonly maxVisible?: number;
  readonly className?: string;
}

/**
 * GitHub-style breadcrumb trail: once there are more segments than fit,
 * the middle ones fold behind a "..." dropdown instead of wrapping or
 * truncating labels. `<details>` gives click/keyboard/outside-close
 * behavior for free, no app-level open state required.
 */
export function Breadcrumbs({ items, maxVisible = 4, className }: BreadcrumbsProps) {
  const { leading, collapsed, trailing } = collapseBreadcrumbs(items, maxVisible);
  const lastId = items.length > 0 ? items[items.length - 1]?.id : undefined;

  return (
    <nav aria-label="Breadcrumb" className={cn('nx-breadcrumbs', className)}>
      <ol className="nx-breadcrumb-list">
        {leading.map((item) => (
          <BreadcrumbCrumb key={item.id} item={item} isLast={item.id === lastId} />
        ))}

        {collapsed.length > 0 ? (
          <li className="nx-breadcrumb-item">
            <details className="nx-breadcrumb-overflow">
              <summary aria-label="Show hidden breadcrumb items">&hellip;</summary>
              <ul className="nx-breadcrumb-overflow-menu">
                {collapsed.map((item) => (
                  <li key={item.id}>
                    <a href={item.href}>{item.label}</a>
                  </li>
                ))}
              </ul>
            </details>
            <span className="nx-breadcrumb-separator" aria-hidden="true">
              /
            </span>
          </li>
        ) : null}

        {trailing.map((item) => (
          <BreadcrumbCrumb key={item.id} item={item} isLast={item.id === lastId} />
        ))}
      </ol>
    </nav>
  );
}

function BreadcrumbCrumb({
  item,
  isLast = false,
}: {
  readonly item: BreadcrumbItem;
  readonly isLast?: boolean;
}) {
  return (
    <li className="nx-breadcrumb-item">
      {isLast ? (
        <span aria-current="page">{item.label}</span>
      ) : (
        <a href={item.href}>{item.label}</a>
      )}
      {!isLast ? (
        <span className="nx-breadcrumb-separator" aria-hidden="true">
          /
        </span>
      ) : null}
    </li>
  );
}
