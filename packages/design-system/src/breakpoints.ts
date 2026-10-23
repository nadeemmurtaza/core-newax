/**
 * The seven responsive tiers from NEWAX's interface-architecture rules
 * (CLAUDE.md "Density, not rearrangement"): min-width in px for each
 * tier. A shared layout law, not a per-brand value -- unlike colours or
 * type, no product gets to pick its own breakpoints.
 */
export const BREAKPOINTS = {
  xs: 0,
  sm: 380,
  fold: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export const BREAKPOINT_ORDER: readonly Breakpoint[] = [
  'xs',
  'sm',
  'fold',
  'md',
  'lg',
  'xl',
  '2xl',
];

/** A `min-width` media query string for the given tier, e.g. `(min-width: 768px)`. */
export function minWidthMediaQuery(tier: Breakpoint): string {
  return `(min-width: ${BREAKPOINTS[tier]}px)`;
}
