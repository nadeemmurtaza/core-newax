import type { BreadcrumbItem } from './types';

export interface CollapsedBreadcrumbs {
  readonly leading: readonly BreadcrumbItem[];
  /** Middle items folded behind the "..." dropdown -- empty when nothing needed collapsing. */
  readonly collapsed: readonly BreadcrumbItem[];
  readonly trailing: readonly BreadcrumbItem[];
}

/**
 * GitHub's breadcrumb overflow rule: once there are more items than fit,
 * keep the first item and the last few, fold everything between behind a
 * "..." dropdown instead of wrapping or truncating labels.
 */
export function collapseBreadcrumbs(
  items: readonly BreadcrumbItem[],
  maxVisible = 4,
): CollapsedBreadcrumbs {
  if (items.length <= maxVisible) {
    return { leading: items, collapsed: [], trailing: [] };
  }

  const trailingCount = maxVisible - 1;
  const leading = items.slice(0, 1);
  const trailing = items.slice(items.length - trailingCount);
  const collapsed = items.slice(1, items.length - trailingCount);

  return { leading, collapsed, trailing };
}
