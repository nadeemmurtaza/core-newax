import { describe, expect, it } from 'vitest';
import { parentPath } from '../src/back-link';

describe('parentPath', () => {
  it('goes one segment up', () => {
    expect(parentPath('/invoices/123')).toBe('/invoices');
  });

  it('returns root for a single-segment path', () => {
    expect(parentPath('/invoices')).toBe('/');
  });

  it('returns root for the root path', () => {
    expect(parentPath('/')).toBe('/');
  });

  it('handles a deep path', () => {
    expect(parentPath('/settings/billing/history')).toBe('/settings/billing');
  });
});
