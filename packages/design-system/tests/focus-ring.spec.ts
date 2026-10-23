import { describe, expect, it } from 'vitest';
import { focusRingVars } from '../src/focus-ring';
import type { BrandTheme } from '../src/types';

const theme = {
  colors: { accent: { DEFAULT: '#0097b2', hover: '#007e95' } },
  colorsDark: { accent: { DEFAULT: '#3fc3de', hover: '#17b4d1' } },
} as unknown as BrandTheme;

describe('focusRingVars', () => {
  it('derives the ring colour from the light accent token by default', () => {
    expect(focusRingVars(theme)['--focus-ring-color']).toBe('#0097b2');
  });

  it('derives the ring colour from the dark accent token when mode is dark', () => {
    expect(focusRingVars(theme, 'dark')['--focus-ring-color']).toBe('#3fc3de');
  });

  it('always sets a width and offset', () => {
    const vars = focusRingVars(theme);
    expect(vars['--focus-ring-width']).toBe('2px');
    expect(vars['--focus-ring-offset']).toBe('2px');
  });
});
