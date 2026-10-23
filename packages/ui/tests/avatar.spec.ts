import { describe, expect, it } from 'vitest';
import { avatarClassName } from '../src/avatar';

describe('avatarClassName', () => {
  it('defaults to md', () => {
    expect(avatarClassName()).toBe('nx-avatar nx-avatar-md');
  });

  it('maps every size', () => {
    expect(avatarClassName('lg')).toBe('nx-avatar nx-avatar-lg');
  });
});
