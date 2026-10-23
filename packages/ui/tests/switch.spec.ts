import { describe, expect, it } from 'vitest';
import { switchClassName } from '../src/switch';

describe('switchClassName', () => {
  it('has no checked class when unchecked', () => {
    expect(switchClassName(false)).toBe('nx-switch');
  });

  it('adds the checked class when checked', () => {
    expect(switchClassName(true)).toBe('nx-switch nx-switch-checked');
  });
});
