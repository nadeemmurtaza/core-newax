import { describe, expect, it } from 'vitest';
import { spaceRem, tailwindSpacingKey } from '../src/space';

describe('spaceRem', () => {
  it('converts to rem against a 16px root', () => {
    expect(spaceRem(8)).toBe('0.5rem');
    expect(spaceRem(44)).toBe('2.75rem');
  });
});

describe('tailwindSpacingKey', () => {
  it('maps a px value onto Tailwind own spacing key on its 4px grid', () => {
    expect(tailwindSpacingKey(2)).toBe('0.5');
    expect(tailwindSpacingKey(8)).toBe('2');
    expect(tailwindSpacingKey(16)).toBe('4');
    expect(tailwindSpacingKey(64)).toBe('16');
  });
});
