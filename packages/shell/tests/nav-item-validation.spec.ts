import { describe, expect, it } from 'vitest';
import { isValidNavItem, isValidBreadcrumbItem } from '../src/nav-item-validation';

describe('isValidNavItem', () => {
  it('accepts a minimal valid item', () => {
    expect(isValidNavItem({ id: 'settings', label: 'Settings', href: '/settings' })).toBe(true);
  });

  it('rejects an invalid id', () => {
    expect(isValidNavItem({ id: 'Settings', label: 'Settings', href: '/settings' })).toBe(false);
  });

  it('rejects a missing label', () => {
    expect(isValidNavItem({ id: 'settings', href: '/settings' })).toBe(false);
  });

  it('validates nested children recursively', () => {
    expect(
      isValidNavItem({
        id: 'settings',
        label: 'Settings',
        href: '/settings',
        children: [{ id: 'billing', label: 'Billing', href: '/settings/billing' }],
      }),
    ).toBe(true);

    expect(
      isValidNavItem({
        id: 'settings',
        label: 'Settings',
        href: '/settings',
        children: [{ id: 'Billing', label: 'Billing', href: '/settings/billing' }],
      }),
    ).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isValidNavItem(null)).toBe(false);
    expect(isValidNavItem('settings')).toBe(false);
  });
});

describe('isValidBreadcrumbItem', () => {
  it('accepts a valid item', () => {
    expect(isValidBreadcrumbItem({ id: 'settings', label: 'Settings', href: '/settings' })).toBe(
      true,
    );
  });

  it('rejects an invalid id', () => {
    expect(isValidBreadcrumbItem({ id: '1', label: 'One', href: '/1' })).toBe(false);
  });
});
