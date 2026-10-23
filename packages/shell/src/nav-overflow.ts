import type { NavItem } from './types';

export interface CollapsedNavItems {
  readonly visible: readonly NavItem[];
  /** Items folded behind a "More" dropdown -- empty when everything fits. */
  readonly collapsed: readonly NavItem[];
}

/** Same overflow shape as collapseBreadcrumbs, applied to a flat nav row:
 * once there are more items than fit, the tail folds behind "More" instead
 * of wrapping to a second line or shrinking labels unreadably. */
export function collapseNavItems(items: readonly NavItem[], maxVisible = 5): CollapsedNavItems {
  if (items.length <= maxVisible) {
    return { visible: items, collapsed: [] };
  }
  return { visible: items.slice(0, maxVisible), collapsed: items.slice(maxVisible) };
}
