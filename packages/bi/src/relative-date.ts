import type { DateRangeValue, RelativeDatePreset } from './types';

/** Everything here operates on UTC calendar fields, deliberately --
 * mixing local-time Date construction with `toISOString()` silently
 * shifts the date by a day for any timezone with a non-zero UTC offset. */
function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Resolves a relative-date preset against `now` into an actual start/end
 * date. The one place this calculation happens -- every date-range
 * slicer in every NEWAX app goes through this instead of each one
 * reimplementing "last 7 days" slightly differently.
 */
export function resolveRelativeDateRange(
  preset: RelativeDatePreset,
  now: Date = new Date(),
): Pick<DateRangeValue, 'start' | 'end'> {
  const today = utcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  switch (preset) {
    case 'today':
      return { start: toIsoDate(today), end: toIsoDate(today) };
    case 'yesterday': {
      const yesterday = addUtcDays(today, -1);
      return { start: toIsoDate(yesterday), end: toIsoDate(yesterday) };
    }
    case 'last7days':
      return { start: toIsoDate(addUtcDays(today, -6)), end: toIsoDate(today) };
    case 'last30days':
      return { start: toIsoDate(addUtcDays(today, -29)), end: toIsoDate(today) };
    case 'thisMonth':
      return {
        start: toIsoDate(utcDate(today.getUTCFullYear(), today.getUTCMonth(), 1)),
        end: toIsoDate(today),
      };
    case 'lastMonth': {
      const start = utcDate(today.getUTCFullYear(), today.getUTCMonth() - 1, 1);
      const end = addUtcDays(utcDate(today.getUTCFullYear(), today.getUTCMonth(), 1), -1);
      return { start: toIsoDate(start), end: toIsoDate(end) };
    }
    case 'quarterToDate': {
      const quarterStartMonth = Math.floor(today.getUTCMonth() / 3) * 3;
      return {
        start: toIsoDate(utcDate(today.getUTCFullYear(), quarterStartMonth, 1)),
        end: toIsoDate(today),
      };
    }
    case 'yearToDate':
      return { start: toIsoDate(utcDate(today.getUTCFullYear(), 0, 1)), end: toIsoDate(today) };
    case 'custom':
      throw new Error(
        'resolveRelativeDateRange cannot resolve "custom" -- read start/end directly.',
      );
  }
}
