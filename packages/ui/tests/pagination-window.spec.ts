import { describe, expect, it } from 'vitest';
import { buildPaginationWindow } from '../src/pagination-window';

describe('buildPaginationWindow', () => {
  it('returns an empty array for zero pages', () => {
    expect(buildPaginationWindow(1, 0)).toEqual([]);
  });

  it('shows every page when the total fits within the window', () => {
    expect(buildPaginationWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('folds the middle with one ellipsis on each side when far from both ends', () => {
    expect(buildPaginationWindow(10, 20, 1)).toEqual([1, 'ellipsis', 9, 10, 11, 'ellipsis', 20]);
  });

  it('only folds the right side when near the start', () => {
    expect(buildPaginationWindow(2, 20, 1)).toEqual([1, 2, 3, 'ellipsis', 20]);
  });

  it('only folds the left side when near the end', () => {
    expect(buildPaginationWindow(19, 20, 1)).toEqual([1, 'ellipsis', 18, 19, 20]);
  });

  it('always includes the first and last page', () => {
    const result = buildPaginationWindow(50, 100, 2);
    expect(result[0]).toBe(1);
    expect(result[result.length - 1]).toBe(100);
  });
});
