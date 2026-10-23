import { hexToRgb, rgbToHex, type Hex } from './color';

/**
 * WCAG 2.x contrast, as a function -- one implementation for whatever spec
 * guards a product's palette and whatever reference page shows it.
 */

/** Relative luminance of an sRGB colour, 0 (black) to 1 (white). */
export function relativeLuminance(rgb: readonly [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two colours, order-independent, 1:1 to 21:1. */
export function contrastRatio(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** `fg` at `alpha` over an opaque `bg` -- a translucent colour has no contrast of its own until it is composited. */
export function compositeRgb(
  fg: readonly [number, number, number],
  bg: readonly [number, number, number],
  alpha: number,
): [number, number, number] {
  return fg.map((v, i) => v * alpha + bg[i]! * (1 - alpha)) as [number, number, number];
}

/** Same as `contrastRatio`, from hex strings. */
export function contrastRatioHex(a: string, b: string): number {
  return contrastRatio(hexToRgb(a), hexToRgb(b));
}

/** WCAG conformance label for a ratio at a text size. */
export function wcagLevel(ratio: number, large = false): 'AAA' | 'AA' | 'fail' {
  if (ratio >= (large ? 4.5 : 7)) {
    return 'AAA';
  }
  if (ratio >= (large ? 3 : 4.5)) {
    return 'AA';
  }
  return 'fail';
}

/** One colour pair a product's palette is checked against. */
export interface ContrastPair {
  readonly label: string;
  readonly fg: Hex;
  readonly bg: Hex;
  /** 4.5 for body text, 3 for large text / non-text UI (WCAG 2.x). */
  readonly floor: number;
}

export interface ContrastResult extends ContrastPair {
  readonly ratio: number;
  readonly level: 'AAA' | 'AA' | 'fail';
  readonly ok: boolean;
}

/**
 * Checks a whole palette against its floors in one pass -- the shape every
 * product's own `scripts/check-contrast.mjs` wants, so that script is a
 * data table (its own colour pairs) plus one call here, not a hand-rolled
 * loop reinvented per repo.
 */
export function checkContrastPairs(pairs: readonly ContrastPair[]): ContrastResult[] {
  return pairs.map((p) => {
    const ratio = contrastRatioHex(p.fg, p.bg);
    return { ...p, ratio, level: wcagLevel(ratio, p.floor <= 3), ok: ratio >= p.floor };
  });
}

/**
 * Darkens `fg` toward black -- uniform RGB scaling, which preserves hue for
 * the near-neutral greys a border/faint-ink token actually is -- until it
 * clears `floor` against `bg`, or gives up after 200 steps (an unreachable
 * floor, e.g. requesting AAA text contrast from a near-white starting
 * colour). Same philosophy as darkening a brand accent for a text pair
 * elsewhere in this ecosystem: same hue, lightness only, smallest change
 * that clears the floor.
 */
export function darkenToContrastHex(fg: Hex, bg: Hex, floor: number): Hex {
  const bgRgb = hexToRgb(bg);
  let rgb = hexToRgb(fg);
  for (let i = 0; i < 200 && contrastRatio(rgb, bgRgb) < floor; i++) {
    rgb = rgb.map((v) => v * 0.97) as [number, number, number];
  }
  return rgbToHex(rgb);
}
