import { describe, expect, it } from 'vitest';
import { textareaClassName } from '../src/textarea';

describe('textareaClassName', () => {
  it('has no error class by default', () => {
    expect(textareaClassName(false)).toBe('nx-textarea');
  });

  it('adds the error class when error is true', () => {
    expect(textareaClassName(true)).toBe('nx-textarea nx-textarea-error');
  });
});
