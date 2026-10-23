import { describe, expect, it } from 'vitest';
import { applyFilter, clearAllFilters, clearFilter, matchesFilters } from '../src/cross-filter';
import type { FilterValue } from '../src/types';

describe('applyFilter', () => {
  it('adds a new field filter', () => {
    const result = applyFilter([], { field: 'region', selected: ['us'] });
    expect(result).toEqual([{ field: 'region', selected: ['us'] }]);
  });

  it('replaces an existing field filter', () => {
    const existing: FilterValue[] = [{ field: 'region', selected: ['us'] }];
    const result = applyFilter(existing, { field: 'region', selected: ['eu'] });
    expect(result).toEqual([{ field: 'region', selected: ['eu'] }]);
  });

  it('removes the field when selected is empty', () => {
    const existing: FilterValue[] = [{ field: 'region', selected: ['us'] }];
    const result = applyFilter(existing, { field: 'region', selected: [] });
    expect(result).toEqual([]);
  });

  it('leaves other fields untouched', () => {
    const existing: FilterValue[] = [{ field: 'region', selected: ['us'] }];
    const result = applyFilter(existing, { field: 'tier', selected: ['gold'] });
    expect(result).toEqual([
      { field: 'region', selected: ['us'] },
      { field: 'tier', selected: ['gold'] },
    ]);
  });
});

describe('clearFilter / clearAllFilters', () => {
  it('removes one field', () => {
    const existing: FilterValue[] = [
      { field: 'region', selected: ['us'] },
      { field: 'tier', selected: ['gold'] },
    ];
    expect(clearFilter(existing, 'region')).toEqual([{ field: 'tier', selected: ['gold'] }]);
  });

  it('clearAllFilters always returns empty', () => {
    expect(clearAllFilters()).toEqual([]);
  });
});

describe('matchesFilters', () => {
  const filters: FilterValue[] = [
    { field: 'region', selected: ['us', 'eu'] },
    { field: 'tier', selected: ['gold'] },
  ];

  it('matches a row satisfying every filter', () => {
    expect(matchesFilters({ region: 'us', tier: 'gold' }, filters)).toBe(true);
  });

  it('rejects a row failing one filter', () => {
    expect(matchesFilters({ region: 'us', tier: 'silver' }, filters)).toBe(false);
  });

  it('matches anything when there are no filters', () => {
    expect(matchesFilters({ region: 'anywhere' }, [])).toBe(true);
  });
});
