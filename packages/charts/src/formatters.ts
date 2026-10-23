import type { ValueFormat } from './types';

export interface FormatOptions {
  readonly currency?: string;
  readonly locale?: string;
}

/**
 * One formatting path for every chart's axis labels, tooltips, and data
 * labels, so a currency axis and its tooltip never disagree on
 * decimals/locale -- each chart calling `toLocaleString` itself is
 * exactly the drift this function exists to prevent.
 */
export function formatChartValue(
  value: number,
  format: ValueFormat = 'number',
  options: FormatOptions = {},
): string {
  const locale = options.locale ?? 'en-US';

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: options.currency ?? 'USD',
        maximumFractionDigits: 0,
      }).format(value);
    case 'percent':
      return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(
        value,
      );
    case 'compact':
      return new Intl.NumberFormat(locale, {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(value);
    case 'integer':
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
    case 'number':
    default:
      return new Intl.NumberFormat(locale).format(value);
  }
}
