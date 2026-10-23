import type { BreadcrumbItem, NavItem } from './types';

const ITEM_ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/u;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isValidNavItem(value: unknown): value is NavItem {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<NavItem>;
  if (!ITEM_ID_PATTERN.test(candidate.id ?? '') || !isNonEmptyString(candidate.label)) {
    return false;
  }
  if (!isNonEmptyString(candidate.href)) {
    return false;
  }
  if (candidate.children !== undefined) {
    if (!Array.isArray(candidate.children)) {
      return false;
    }
    return candidate.children.every((child) => isValidNavItem(child));
  }
  return true;
}

export function isValidBreadcrumbItem(value: unknown): value is BreadcrumbItem {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<BreadcrumbItem>;
  return (
    ITEM_ID_PATTERN.test(candidate.id ?? '') &&
    isNonEmptyString(candidate.label) &&
    isNonEmptyString(candidate.href)
  );
}
