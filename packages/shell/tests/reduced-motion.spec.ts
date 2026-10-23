import { describe, expect, it } from 'vitest';
import { prefersReducedMotion } from '../src/reduced-motion';

describe('prefersReducedMotion', () => {
  it('returns false when window/matchMedia is unavailable (node/SSR)', () => {
    expect(prefersReducedMotion()).toBe(false);
  });
});
