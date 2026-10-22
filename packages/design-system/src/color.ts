export type Hex = string;
export type Scale = Readonly<Record<string, Hex>>;

/** The stock Tailwind scales a product uses, passed in by the app. */
export interface StockHues {
  readonly red: Scale;
  readonly green: Scale;
  readonly amber: Scale;
  readonly blue: Scale;
}

export const STOCK_HUE_NAMES = ['red', 'green', 'amber', 'blue'] as const;
export type StockHueName = (typeof STOCK_HUE_NAMES)[number];

export const COLOR_STEPS = [
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950',
] as const;
export const NEUTRAL_STEPS = [
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
] as const;

/** Steps at or below this are tints (washes and hairlines); above it are solids and ink. */
export const TINT_STEPS = ['50', '100', '200', '300'] as const;

/**
 * How much of a hue's 500 is mixed into the dark surface to make each tint.
 * 10/16/26/40 %: the lightest wash has to read as "tinted" on a near-black
 * card without glowing, and the 200 step is what a `border-red-200` draws as
 * a hairline, which wants to be clearly there against its own 50 wash.
 */
export const TINT_MIX: Readonly<Record<(typeof TINT_STEPS)[number], number>> = {
  '50': 0.1,
  '100': 0.16,
  '200': 0.26,
  '300': 0.4,
};

export function hexToRgb(hex: Hex): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

export function rgbToHex([r, g, b]: readonly [number, number, number]): Hex {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

/** `fg` over `bg` at `alpha`, as an opaque hex. */
export function mixHex(fg: Hex, bg: Hex, alpha: number): Hex {
  const a = hexToRgb(fg);
  const b = hexToRgb(bg);
  return rgbToHex(a.map((v, i) => v * alpha + b[i]! * (1 - alpha)) as [number, number, number]);
}

/** `#0e8294` -> `'14 130 148'`, the form `rgb(var(--x) / <alpha-value>)` needs. */
export function channels(hex: Hex): string {
  return hexToRgb(hex).join(' ');
}

/**
 * A stock hue scale, re-derived for a dark surface. Tints (50-300) are the
 * hue's 500 mixed into the surface -- a wash, not a neon. Everything from
 * 400 up is ink (text, a line) and is pulled from the LIGHT end of the scale
 * so it reads on dark. Lightness is reversed; the hue is not.
 */
export function darkHueScale(stock: Scale, surface: Hex): Record<string, Hex> {
  const out: Record<string, Hex> = {};
  for (const step of TINT_STEPS) {
    out[step] = mixHex(stock['500']!, surface, TINT_MIX[step]);
  }
  out['400'] = stock['400']!;
  out['500'] = stock['400']!;
  out['600'] = stock['400']!;
  out['700'] = stock['300']!;
  out['800'] = stock['200']!;
  out['900'] = stock['100']!;
  out['950'] = stock['50']!;
  return out;
}

/**
 * A theme colour as a plain CSS value, for the places a class cannot reach:
 * an SVG `stroke`, a chart tick, an inline style. Resolves through the same
 * custom property the utilities do, so it repaints the instant the theme
 * changes -- no hook, no re-render, no second copy of the palette in JS.
 *
 * `themeColorVar('neutral-900', 0.6)` -> `rgb(var(--color-neutral-900) / 0.6)`.
 */
export function themeColorVar(name: string, alpha?: number): string {
  return alpha === undefined ? `rgb(var(--color-${name}))` : `rgb(var(--color-${name}) / ${alpha})`;
}
