/**
 * The shape every product's own brand.ts `theme` object must satisfy to use
 * this package. core-newax owns the engine (these types, the derivations in
 * the other files here); each product owns its own VALUES (its brand.ts) --
 * never the other way round. See packages/design-system/README.md.
 */

export interface TypeStep {
  /** px */
  readonly size: number;
  /** px */
  readonly line: number;
}

/** The named steps every product's type scale must provide. */
export interface ThemeType {
  readonly micro: TypeStep;
  readonly tiny: TypeStep;
  readonly small: TypeStep;
  readonly body: TypeStep;
  readonly large: TypeStep;
  readonly heading: TypeStep;
  readonly title: TypeStep;
  readonly display: TypeStep;
  readonly metric: TypeStep;
}

export interface ThemeFonts {
  readonly googleFont: string;
  readonly displayStack: readonly string[];
  readonly sansStack: readonly string[];
  readonly rtlStack?: readonly string[];
  readonly rtlLineHeight?: number;
}

export interface ThemeSpace {
  readonly 0: number;
  readonly 1: number;
  readonly 2: number;
  readonly 3: number;
  readonly 4: number;
  readonly 5: number;
  readonly 6: number;
  readonly 7: number;
  readonly 8: number;
  readonly 9: number;
}

export interface ThemeSize {
  readonly control: {
    readonly sm: number;
    readonly md: number;
    readonly lg: number;
    readonly xl: number;
  };
  readonly icon: { readonly sm: number; readonly md: number; readonly lg: number };
  readonly touch: { readonly min: number; readonly pos: number };
}

export interface ThemeRadii {
  readonly sharp: number;
  readonly lg: number;
  readonly pill: number;
}

export interface ElevationSteps {
  readonly flat: string;
  readonly raised: string;
  readonly overlay: string;
  readonly modal: string;
}

export interface ThemeElevation {
  readonly light: ElevationSteps;
  readonly dark: ElevationSteps;
}

export interface ThemeLayers {
  readonly [name: string]: number;
}

export interface ThemeMotion {
  readonly duration: { readonly [name: string]: number };
  readonly easing: { readonly [name: string]: readonly number[] };
  readonly distance: { readonly [name: string]: number };
  readonly scale: { readonly [name: string]: number };
  readonly stagger: { readonly step: number; readonly fine: number };
  readonly speed: { readonly read: number };
}

export interface ThemeFeedback {
  readonly positive: string;
  readonly negative: string;
}

export interface ThemeColorsBase {
  readonly neutral: { readonly [step: string]: string };
  readonly accent: { readonly DEFAULT: string; readonly hover: string };
  readonly white: string;
  readonly surface: string;
  readonly overlay: string;
  readonly inverse: string;
  readonly onInverse: string;
  readonly scrim: string;
  readonly star: string;
  readonly feedback: ThemeFeedback;
  readonly chart: readonly string[];
}

/** Light has no `accentInk`: fill and ink are one colour there. */
export type ThemeColors = ThemeColorsBase;

/** Dark adds `accentInk`: fill and ink diverge on a dark surface. */
export interface ThemeColorsDark extends ThemeColorsBase {
  readonly accentInk: { readonly DEFAULT: string; readonly hover: string };
}

/** The full contract a product's `BRAND.theme` must satisfy. */
export interface BrandTheme {
  readonly colors: ThemeColors;
  readonly colorsDark: ThemeColorsDark;
  readonly radii: ThemeRadii;
  readonly type: ThemeType;
  readonly fonts: ThemeFonts;
  readonly space: ThemeSpace;
  readonly size: ThemeSize;
  readonly elevation: ThemeElevation;
  readonly layers: ThemeLayers;
  readonly motion: ThemeMotion;
}
