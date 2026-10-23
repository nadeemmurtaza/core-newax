import type { ReactNode } from 'react';
import { cn } from '@newaxhq/ui';
import { isNavItemActive } from './active-route';
import type { NavItem } from './types';

export interface SidebarProps {
  readonly items: readonly NavItem[];
  readonly currentPath: string;
  /** Controlled, not internal state -- the host app owns and persists this
   * (e.g. localStorage), matching the one-source-of-truth rule for layout state. */
  readonly collapsed: boolean;
  readonly onToggleCollapse: () => void;
  readonly label: string;
  readonly topSlot?: ReactNode;
  readonly bottomSlot?: ReactNode;
  readonly className?: string;
}

/**
 * One sidebar implementation shared by the primary and secondary nav --
 * two instances, independently collapsed, rather than two components that
 * would drift apart. Collapsed state is a visual density change only;
 * `items` never changes between collapsed/expanded (seven-tier rule: the
 * architecture doesn't change, the density does).
 */
export function Sidebar({
  items,
  currentPath,
  collapsed,
  onToggleCollapse,
  label,
  topSlot,
  bottomSlot,
  className,
}: SidebarProps) {
  return (
    <nav
      aria-label={label}
      className={cn('nx-sidebar', collapsed && 'nx-sidebar-collapsed', className)}
    >
      {topSlot ? <div className="nx-sidebar-top">{topSlot}</div> : null}

      <ul className="nx-sidebar-nav">
        {items.map((item) => (
          <SidebarNode key={item.id} item={item} currentPath={currentPath} collapsed={collapsed} />
        ))}
      </ul>

      {bottomSlot ? <div className="nx-sidebar-bottom">{bottomSlot}</div> : null}

      <button
        type="button"
        className="nx-sidebar-toggle"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        aria-label={collapsed ? `Expand ${label}` : `Collapse ${label}`}
      >
        {collapsed ? '»' : '«'}
      </button>
    </nav>
  );
}

function SidebarNode({
  item,
  currentPath,
  collapsed,
}: {
  readonly item: NavItem;
  readonly currentPath: string;
  readonly collapsed: boolean;
}) {
  const active = isNavItemActive(item.href, currentPath);

  return (
    <li className="nx-sidebar-item">
      <a
        href={item.href}
        className={cn('nx-sidebar-link', active && 'nx-sidebar-link-active')}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? item.label : undefined}
      >
        <span className="nx-sidebar-link-label">{item.label}</span>
      </a>
      {item.children && item.children.length > 0 && !collapsed ? (
        <ul className="nx-sidebar-subnav">
          {item.children.map((child) => (
            <SidebarNode
              key={child.id}
              item={child}
              currentPath={currentPath}
              collapsed={collapsed}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
