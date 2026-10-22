import { describe, expect, it } from 'vitest';
import { concentricRadius, radiusPx } from '../src/radii';

describe('concentricRadius', () => {
  it('is the outer corner minus the inset', () => {
    expect(concentricRadius(24, 8)).toBe(16);
    expect(concentricRadius(24, 0)).toBe(24);
  });

  it('never goes negative: an inset past the outer corner is square', () => {
    expect(concentricRadius(3, 8)).toBe(0);
    expect(concentricRadius(8, 8)).toBe(0);
  });

  it('treats a negative inset as none, so a bad input cannot enlarge the inner corner', () => {
    expect(concentricRadius(24, -8)).toBe(24);
  });

  it('formats for the CSS side', () => {
    expect(radiusPx(concentricRadius(24, 8))).toBe('16px');
  });
});
