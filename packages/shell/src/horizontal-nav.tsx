import { cn } from '@newaxhq/ui';
import { isNavItemActive } from './active-route';
import type { NavItem } from './types';

export interface HorizontalNavProps {
  readonly items: readonly NavItem[];
  readonly currentPath: string;
  readonly className?: string;
}

/** The secondary horizontal nav under the header -- one flat row, no
 * nesting (nesting belongs in a sidebar, not here). */
export function HorizontalNav({ items, currentPath, className }: HorizontalNavProps) {
  return (
    <nav aria-label="Secondary" className={cn('nx-horizontal-nav', className)}>
      <ul className="nx-horizontal-nav-list">
        {items.map((item) => {
          const active = isNavItemActive(item.href, currentPath);
          return (
            <li key={item.id} className="nx-horizontal-nav-item">
              <a
                href={item.href}
                className={cn('nx-horizontal-nav-link', active && 'nx-horizontal-nav-link-active')}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
