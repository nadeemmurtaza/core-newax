import { describe, expect, it } from 'vitest';
import { BREAKPOINTS, BREAKPOINT_ORDER, minWidthMediaQuery } from '../src/breakpoints';

describe('BREAKPOINTS', () => {
  it('matches the seven documented tiers in ascending order', () => {
    expect(BREAKPOINT_ORDER.map((tier) => BREAKPOINTS[tier])).toEqual([
      0, 380, 640, 768, 1024, 1280, 1536,
    ]);
  });
});

describe('minWidthMediaQuery', () => {
  it('builds a min-width media query for a tier', () => {
    expect(minWidthMediaQuery('md')).toBe('(min-width: 768px)');
  });
});
