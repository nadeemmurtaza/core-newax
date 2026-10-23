import { describe, expect, it } from 'vitest';
import { buttonClassName } from '../src/button';

describe('buttonClassName', () => {
  it('defaults to primary/md', () => {
    expect(buttonClassName()).toBe('nx-btn nx-btn-primary nx-btn-md');
  });

  it('maps every variant and size', () => {
    expect(buttonClassName('destructive', 'lg')).toBe('nx-btn nx-btn-destructive nx-btn-lg');
  });

  it('appends a caller-supplied className', () => {
    expect(buttonClassName('primary', 'md', 'w-full')).toBe(
      'nx-btn nx-btn-primary nx-btn-md w-full',
    );
  });
});
