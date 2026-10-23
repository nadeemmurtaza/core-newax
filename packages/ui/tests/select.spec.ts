import { describe, expect, it } from 'vitest';
import { selectClassName } from '../src/select';

describe('selectClassName', () => {
  it('has no error class by default', () => {
    expect(selectClassName(false)).toBe('nx-select');
  });

  it('adds the error class when error is true', () => {
    expect(selectClassName(true)).toBe('nx-select nx-select-error');
  });
});
