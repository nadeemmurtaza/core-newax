/** A nav item is active on an exact match, or when the current path is inside its subtree. */
export function isNavItemActive(itemHref: string, currentPath: string): boolean {
  if (itemHref === '/') {
    return currentPath === '/';
  }
  return currentPath === itemHref || currentPath.startsWith(`${itemHref}/`);
}
