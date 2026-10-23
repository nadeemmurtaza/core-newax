import { describe, expect, it } from 'vitest';
import { resolveRelativeDateRange } from '../src/relative-date';

const NOW = new Date('2026-03-15T12:00:00Z');

describe('resolveRelativeDateRange', () => {
  it('resolves today', () => {
    expect(resolveRelativeDateRange('today', NOW)).toEqual({
      start: '2026-03-15',
      end: '2026-03-15',
    });
  });

  it('resolves yesterday', () => {
    expect(resolveRelativeDateRange('yesterday', NOW)).toEqual({
      start: '2026-03-14',
      end: '2026-03-14',
    });
  });

  it('resolves last7days inclusive of today', () => {
    expect(resolveRelativeDateRange('last7days', NOW)).toEqual({
      start: '2026-03-09',
      end: '2026-03-15',
    });
  });

  it('resolves thisMonth', () => {
    expect(resolveRelativeDateRange('thisMonth', NOW)).toEqual({
      start: '2026-03-01',
      end: '2026-03-15',
    });
  });

  it('resolves lastMonth as the full prior calendar month', () => {
    expect(resolveRelativeDateRange('lastMonth', NOW)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  it('resolves quarterToDate', () => {
    expect(resolveRelativeDateRange('quarterToDate', NOW)).toEqual({
      start: '2026-01-01',
      end: '2026-03-15',
    });
  });

  it('resolves yearToDate', () => {
    expect(resolveRelativeDateRange('yearToDate', NOW)).toEqual({
      start: '2026-01-01',
      end: '2026-03-15',
    });
  });

  it('throws for custom, since it cannot be derived', () => {
    expect(() => resolveRelativeDateRange('custom', NOW)).toThrow(/custom/);
  });
});
