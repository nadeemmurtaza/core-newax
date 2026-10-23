import { describe, expect, it } from 'vitest';
import { isNavItemActive } from '../src/active-route';

describe('isNavItemActive', () => {
  it('matches an exact path', () => {
    expect(isNavItemActive('/settings', '/settings')).toBe(true);
  });

  it('matches a subtree path', () => {
    expect(isNavItemActive('/settings', '/settings/billing')).toBe(true);
  });

  it('does not match a sibling that merely shares a prefix', () => {
    expect(isNavItemActive('/settings', '/settings-advanced')).toBe(false);
  });

  it('does not match an unrelated path', () => {
    expect(isNavItemActive('/settings', '/billing')).toBe(false);
  });

  it('treats "/" as active only on the exact root', () => {
    expect(isNavItemActive('/', '/')).toBe(true);
    expect(isNavItemActive('/', '/anything')).toBe(false);
  });
});
