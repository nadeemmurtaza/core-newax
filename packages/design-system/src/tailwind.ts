import {
  channels,
  darkHueScale,
  COLOR_STEPS,
  NEUTRAL_STEPS,
  STOCK_HUE_NAMES,
  TINT_STEPS,
  type Scale,
  type StockHueName,
  type StockHues,
} from './color';
import { cubicBezier, ms } from './motion';
import { buildSizeSpacingPx } from './size';
import { spaceRem } from './space';
import type { BrandTheme } from './types';

/**
 * The Tailwind side of the theme -- plain data, no Tailwind import. This
 * package has no dependency on Tailwind and must not gain one: a POS app or
 * React Native reads the same tokens and neither uses it. So this returns
 * the pieces (`colors`, `boxShadow`, `baseStyles`, ...) and each app's own
 * `tailwind.config.ts` drops them into its own config. The one thing the
 * engine cannot know is Tailwind's stock hue scales, so the app passes the
 * four it actually uses, via `stock`.
 *
 * HOW A THEME WORKS. Every colour utility resolves to a CSS custom property
 * holding an `r g b` triplet (`rgb(var(--color-neutral-50) / <alpha-value>)`),
 * so `text-neutral-900/60` keeps working. `:root` declares the light values;
 * `[data-theme='dark']` re-declares the same names. Nothing in a component
 * says which theme it is in.
 *
 * WHY THERE ARE TWO RESOLUTIONS OF ONE NAME. `bg-accent` and `text-accent`
 * cannot be one colour in dark: a fill has to stay dark enough for its white
 * label (white-on-fill >= 4.5:1) and an ink has to be light enough to read
 * on a dark surface (>= 4.5:1). No single hue does both -- the gap between
 * "dark enough for white" and "light enough for dark" is empty. So:
 *
 *   `colors`           ink  -- text, border, ring, divide, fill, stroke
 *   `backgroundColor`  fill -- `bg-*`, where a label sits on top
 */

/** The shape Tailwind's `addBase` takes, restated so this package needs no Tailwind types. */
export interface CssRules {
  [selector: string]: string | string[] | CssRules;
}

const ref = (name: string) => `rgb(var(--color-${name}) / <alpha-value>)`;

type Vars = Record<string, string>;

function neutralVars(neutral: Scale): Vars {
  const vars: Vars = {};
  for (const step of NEUTRAL_STEPS) {
    vars[`--color-neutral-${step}`] = channels(neutral[step]!);
  }
  return vars;
}

function hueVars(name: StockHueName, scale: Scale): Vars {
  const vars: Vars = {};
  for (const step of COLOR_STEPS) {
    vars[`--color-${name}-${step}`] = channels(scale[step]!);
  }
  return vars;
}

/**
 * Every custom property that changes between themes: the colours, and the
 * shadows (which are colours too). Declared at `:root`, at
 * `[data-theme='light']` and at `[data-theme='dark']`, so a region can pin
 * itself to one theme whatever the page is in.
 */
export function themeVars(brand: BrandTheme, theme: 'light' | 'dark', stock: StockHues): Vars {
  const c = theme === 'light' ? brand.colors : brand.colorsDark;
  const elevation = brand.elevation[theme];
  // Light has no `accentInk`: fill and ink are one colour there.
  const accentInk = theme === 'light' ? brand.colors.accent : brand.colorsDark.accentInk;

  const vars: Vars = {
    ...neutralVars(c.neutral),
    '--color-surface': channels(c.surface),
    '--color-overlay': channels(c.overlay),
    '--color-inverse': channels(c.inverse),
    '--color-on-inverse': channels(c.onInverse),
    '--color-scrim': channels(c.scrim),
    '--color-accent-ink': channels(accentInk.DEFAULT),
    '--color-accent-ink-hover': channels(accentInk.hover),
    '--color-feedback-positive': channels(c.feedback.positive),
    '--color-feedback-negative': channels(c.feedback.negative),
    ...Object.fromEntries(c.chart.map((hex, i) => [`--color-chart-${i}`, channels(hex)])),
    '--shadow-flat': elevation.flat,
    '--shadow-raised': elevation.raised,
    '--shadow-overlay': elevation.overlay,
    '--shadow-modal': elevation.modal,
  };

  for (const hue of STOCK_HUE_NAMES) {
    Object.assign(
      vars,
      hueVars(hue, theme === 'light' ? stock[hue] : darkHueScale(stock[hue], c.surface)),
    );
  }
  return vars;
}

/** Custom properties that do not change between themes: motion. */
export function staticVars(brand: BrandTheme): Vars {
  const m = brand.motion;
  const vars: Vars = {};
  for (const [name, value] of Object.entries(m.duration)) {
    vars[`--motion-duration-${name}`] = ms(value);
  }
  for (const [name, points] of Object.entries(m.easing)) {
    vars[`--motion-easing-${name}`] = cubicBezier(points);
  }
  for (const [name, px] of Object.entries(m.distance)) {
    vars[`--motion-distance-${name}`] = `${px}px`;
  }
  for (const [name, value] of Object.entries(m.scale)) {
    vars[`--motion-scale-${name}`] = String(value);
  }
  vars['--motion-stagger-step'] = ms(m.stagger.step);
  vars['--motion-stagger-fine'] = ms(m.stagger.fine);
  vars['--motion-speed-read'] = `${m.speed.read}px`;
  return vars;
}

function inkHue(name: StockHueName): Record<string, string> {
  return Object.fromEntries(COLOR_STEPS.map((step) => [step, ref(`${name}-${step}`)]));
}

/** `bg-*` for a stock hue: washes follow the theme, solids keep their stock value. */
function fillHue(name: StockHueName, stock: Scale): Record<string, string> {
  const out: Record<string, string> = {};
  for (const step of COLOR_STEPS) {
    out[step] = (TINT_STEPS as readonly string[]).includes(step)
      ? ref(`${name}-${step}`)
      : stock[step]!;
  }
  return out;
}

export function createThemeTailwind(brand: BrandTheme, stock: StockHues) {
  const light = brand.colors;
  // `black` is deliberately absent: an absolute black fill is `scrim` (a veil) or
  // `inverse` (a fill that flips), and a literal one would not flip with the theme.
  const fixed = { white: light.white } as const;

  const neutral = Object.fromEntries(NEUTRAL_STEPS.map((s) => [s, ref(`neutral-${s}`)]));

  return {
    /**
     * REPLACES `theme.colors` (not `extend`). The palette is closed on
     * purpose: a stock hue not listed here has no dark value, so
     * `text-orange-600` would be correct in light and wrong in dark with no
     * error anywhere. Unlisted, it generates no CSS -- a visible bug
     * instead of a silent one.
     */
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      ...fixed,
      neutral,
      accent: { DEFAULT: ref('accent-ink'), hover: ref('accent-ink-hover') },
      star: light.star,
      feedback: { positive: ref('feedback-positive'), negative: ref('feedback-negative') },
      surface: ref('surface'),
      overlay: ref('overlay'),
      inverse: ref('inverse'),
      'on-inverse': ref('on-inverse'),
      scrim: ref('scrim'),
      red: inkHue('red'),
      green: inkHue('green'),
      amber: inkHue('amber'),
      blue: inkHue('blue'),
    },

    /** Merged into `theme.extend`: where a fill differs from an ink. */
    backgroundColor: {
      white: ref('surface'),
      accent: { DEFAULT: light.accent.DEFAULT, hover: light.accent.hover },
      red: fillHue('red', stock.red),
      green: fillHue('green', stock.green),
      amber: fillHue('amber', stock.amber),
      blue: fillHue('blue', stock.blue),
    },
    /**
     * A bare `border` (no colour class) is the hairline, `neutral-100`: the
     * closed palette has no `gray-200` for Tailwind's preflight to default
     * to, so without this every bare border would paint in the text colour.
     */
    borderColor: { DEFAULT: ref('neutral-100'), white: ref('surface') },
    /** The skeleton shimmer fades to the surface, not to paper. */
    gradientColorStops: { white: ref('surface') },

    /** The stock shadow names map onto the four elevation steps. */
    boxShadow: {
      none: 'none',
      sm: 'var(--shadow-raised)',
      DEFAULT: 'var(--shadow-raised)',
      md: 'var(--shadow-overlay)',
      lg: 'var(--shadow-overlay)',
      xl: 'var(--shadow-modal)',
      '2xl': 'var(--shadow-modal)',
      flat: 'var(--shadow-flat)',
      raised: 'var(--shadow-raised)',
      overlay: 'var(--shadow-overlay)',
      modal: 'var(--shadow-modal)',
    },

    /** REPLACES `theme.zIndex`: a numeric `z-50` is a bug, so it stops existing. */
    zIndex: {
      auto: 'auto',
      ...Object.fromEntries(Object.entries(brand.layers).map(([k, v]) => [k, String(v)])),
    },

    /** Merged into `theme.extend.spacing`: `h-control-md`, `min-h-touch`. */
    spacing: Object.fromEntries(
      Object.entries(buildSizeSpacingPx(brand.size)).map(([k, px]) => [k, spaceRem(px)]),
    ),

    /** Merged into `theme.extend.transitionDuration`. */
    transitionDuration: {
      // A bare `transition-colors` resolves to `DEFAULT`. Tailwind's stock
      // 150ms is a number nobody chose, so the default is `fast` and every
      // un-tokened transition in the app joins the language without a
      // call-site edit.
      DEFAULT: ms(brand.motion.duration.fast!),
      ...Object.fromEntries(Object.entries(brand.motion.duration).map(([k, v]) => [k, ms(v)])),
    },
    /** Merged into `theme.extend.transitionTimingFunction`. */
    transitionTimingFunction: {
      DEFAULT: cubicBezier(brand.motion.easing.standard!),
      ...Object.fromEntries(
        Object.entries(brand.motion.easing).map(([k, v]) => [k, cubicBezier(v)]),
      ),
    },

    /**
     * Handed to Tailwind's `addBase`. Three scopes declare the
     * theme-varying properties: `:root` (light by default),
     * `[data-theme='light']` and `[data-theme='dark']` (an explicit
     * choice, or a pinned region). The media query is the no-JavaScript
     * fallback: with no `data-theme` attribute at all, the OS preference
     * decides.
     */
    baseStyles(): CssRules {
      const lightVars = themeVars(brand, 'light', stock);
      const darkVars = themeVars(brand, 'dark', stock);
      return {
        ':root': { 'color-scheme': 'light', ...staticVars(brand), ...lightVars },
        "[data-theme='light']": { 'color-scheme': 'light', ...lightVars },
        "[data-theme='dark']": { 'color-scheme': 'dark', ...darkVars },
        '@media (prefers-color-scheme: dark)': {
          ':root:not([data-theme])': { 'color-scheme': 'dark', ...darkVars },
        },
      };
    },
  };
}
