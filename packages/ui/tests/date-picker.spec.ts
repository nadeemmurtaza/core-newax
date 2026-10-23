import { describe, expect, it } from 'vitest';
import { datePickerClassName } from '../src/date-picker';

describe('datePickerClassName', () => {
  it('has no error class by default', () => {
    expect(datePickerClassName(false)).toBe('nx-date-picker');
  });

  it('adds the error class when error is true', () => {
    expect(datePickerClassName(true)).toBe('nx-date-picker nx-date-picker-error');
  });
});
