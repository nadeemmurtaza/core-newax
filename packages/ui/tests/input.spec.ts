import { describe, expect, it } from 'vitest';
import { inputClassName } from '../src/input';

describe('inputClassName', () => {
  it('has no error class by default', () => {
    expect(inputClassName(false)).toBe('nx-input');
  });

  it('adds the error class when error is true', () => {
    expect(inputClassName(true)).toBe('nx-input nx-input-error');
  });
});
