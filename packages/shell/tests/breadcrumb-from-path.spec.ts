import { describe, expect, it } from 'vitest';
import { buildBreadcrumbsFromPath } from '../src/breadcrumb-from-path';

describe('buildBreadcrumbsFromPath', () => {
  it('builds one item per segment with accumulating hrefs', () => {
    expect(buildBreadcrumbsFromPath('/settings/billing')).toEqual([
      { id: 'settings', label: 'Settings', href: '/settings' },
      { id: 'billing', label: 'Billing', href: '/settings/billing' },
    ]);
  });

  it('title-cases hyphenated segments', () => {
    expect(buildBreadcrumbsFromPath('/api-keys')).toEqual([
      { id: 'api-keys', label: 'Api Keys', href: '/api-keys' },
    ]);
  });

  it('uses a label override when provided', () => {
    expect(buildBreadcrumbsFromPath('/invoices/a1b2c3', { a1b2c3: 'Invoice #4821' })).toEqual([
      { id: 'invoices', label: 'Invoices', href: '/invoices' },
      { id: 'a1b2c3', label: 'Invoice #4821', href: '/invoices/a1b2c3' },
    ]);
  });

  it('returns an empty list for the root path', () => {
    expect(buildBreadcrumbsFromPath('/')).toEqual([]);
  });
});
