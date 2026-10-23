import type { SeriesConfig } from './types';

/** Default categorical palette, used only when the host app's theme
 * doesn't supply one (BrandTheme.colors.chart from @newaxhq/design-system).
 * This is a fallback, not a second colour system -- pass your theme's
 * `colors.chart` array as `palette` to use the real brand palette. */
export const DEFAULT_CHART_PALETTE: readonly string[] = [
  '#0097b2',
  '#f5b841',
  '#0f7a4d',
  '#b42318',
  '#4b5566',
  '#8a9aa6',
];

/**
 * Assigns a colour to every series: explicit `series.color` wins, the
 * rest draw from `palette` in order, cycling if there are more series
 * than palette entries -- so two series are never silently the same
 * colour when the palette is too short.
 */
export function resolveSeriesColors(
  series: readonly SeriesConfig[],
  palette: readonly string[] = DEFAULT_CHART_PALETTE,
): ReadonlyMap<string, string> {
  const colors = new Map<string, string>();
  let paletteIndex = 0;

  for (const item of series) {
    if (item.color) {
      colors.set(item.key, item.color);
      continue;
    }
    colors.set(item.key, palette[paletteIndex % palette.length] as string);
    paletteIndex += 1;
  }

  return colors;
}
