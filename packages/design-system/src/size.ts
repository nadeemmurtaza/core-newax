import type { ThemeSize } from './types';

/**
 * The spacing keys the size tokens generate, with their pixel size: one list
 * for Tailwind (`h-control-md`, `min-h-touch`) and for a `cn()`'s merge
 * rules, so the two cannot disagree about which names exist.
 */
export function buildSizeSpacingPx(size: ThemeSize): Readonly<Record<string, number>> {
  return {
    'control-sm': size.control.sm,
    'control-md': size.control.md,
    'control-lg': size.control.lg,
    'control-xl': size.control.xl,
    'icon-sm': size.icon.sm,
    'icon-md': size.icon.md,
    'icon-lg': size.icon.lg,
    touch: size.touch.min,
    'touch-pos': size.touch.pos,
  };
}
