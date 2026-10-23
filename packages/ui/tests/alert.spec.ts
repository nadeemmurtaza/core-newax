import { describe, expect, it } from 'vitest';
import { alertClassName } from '../src/alert';

describe('alertClassName', () => {
  it('defaults to info', () => {
    expect(alertClassName()).toBe('nx-alert nx-alert-info');
  });

  it('maps every tone', () => {
    expect(alertClassName('error')).toBe('nx-alert nx-alert-error');
  });
});
