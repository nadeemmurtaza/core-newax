import { cn } from '@newaxhq/ui';
import { isNavItemActive } from './active-route';
import { collapseNavItems } from './nav-overflow';
import type { NavItem } from './types';

export interface HorizontalNavProps {
  readonly items: readonly NavItem[];
  readonly currentPath: string;
  readonly maxVisible?: number;
  readonly className?: string;
}

/** The secondary horizontal nav under the header -- one flat row, no
 * nesting (nesting belongs in a sidebar, not here). Past `maxVisible`,
 * the tail folds behind a "More" dropdown instead of wrapping. */
export function HorizontalNav({
  items,
  currentPath,
  maxVisible = 5,
  className,
}: HorizontalNavProps) {
  const { visible, collapsed } = collapseNavItems(items, maxVisible);

  return (
    <nav aria-label="Secondary" className={cn('nx-horizontal-nav', className)}>
      <ul className="nx-horizontal-nav-list">
        {visible.map((item) => (
          <HorizontalNavLink key={item.id} item={item} currentPath={currentPath} />
        ))}

        {collapsed.length > 0 ? (
          <li className="nx-horizontal-nav-item">
            <details className="nx-horizontal-nav-overflow">
              <summary aria-label="Show more navigation items">More</summary>
              <ul className="nx-horizontal-nav-overflow-menu">
                {collapsed.map((item) => (
                  <li key={item.id}>
                    <a
                      href={item.href}
                      className={cn(
                        'nx-horizontal-nav-link',
                        isNavItemActive(item.href, currentPath) && 'nx-horizontal-nav-link-active',
                      )}
                      aria-current={isNavItemActive(item.href, currentPath) ? 'page' : undefined}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

function HorizontalNavLink({
  item,
  currentPath,
}: {
  readonly item: NavItem;
  readonly currentPath: string;
}) {
  const active = isNavItemActive(item.href, currentPath);
  return (
    <li className="nx-horizontal-nav-item">
      <a
        href={item.href}
        className={cn('nx-horizontal-nav-link', active && 'nx-horizontal-nav-link-active')}
        aria-current={active ? 'page' : undefined}
      >
        {item.label}
      </a>
    </li>
  );
}
