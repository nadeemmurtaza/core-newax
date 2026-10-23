import type { BrandTheme } from './types';

export interface FocusRingVars {
  readonly '--focus-ring-width': string;
  readonly '--focus-ring-offset': string;
  readonly '--focus-ring-color': string;
}

/**
 * The one focus-ring definition every interactive component (@newaxhq/ui's
 * Button/Input/Switch/..., @newaxhq/shell's nav links) should consume
 * instead of each one inventing its own outline -- colour derives from
 * the brand's own accent token, not a hardcoded blue.
 */
export function focusRingVars(theme: BrandTheme, mode: 'light' | 'dark' = 'light'): FocusRingVars {
  const accent = mode === 'dark' ? theme.colorsDark.accent.DEFAULT : theme.colors.accent.DEFAULT;
  return {
    '--focus-ring-width': '2px',
    '--focus-ring-offset': '2px',
    '--focus-ring-color': accent,
  };
}
