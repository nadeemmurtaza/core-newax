import { describe, expect, it } from 'vitest';
import { badgeClassName } from '../src/badge';

describe('badgeClassName', () => {
  it('defaults to neutral', () => {
    expect(badgeClassName()).toBe('nx-badge nx-badge-neutral');
  });

  it('maps every tone', () => {
    expect(badgeClassName('danger')).toBe('nx-badge nx-badge-danger');
  });

  it('appends a caller-supplied className', () => {
    expect(badgeClassName('success', 'ml-2')).toBe('nx-badge nx-badge-success ml-2');
  });
});
