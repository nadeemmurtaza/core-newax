import { describe, expect, it } from 'vitest';
import { resolveSeriesColors } from '../src/palette';
import type { SeriesConfig } from '../src/types';

describe('resolveSeriesColors', () => {
  it('assigns palette colors in order', () => {
    const series: SeriesConfig[] = [
      { key: 'a', label: 'A' },
      { key: 'b', label: 'B' },
    ];
    const colors = resolveSeriesColors(series, ['#111', '#222']);
    expect(colors.get('a')).toBe('#111');
    expect(colors.get('b')).toBe('#222');
  });

  it('respects an explicit series color over the palette', () => {
    const series: SeriesConfig[] = [{ key: 'a', label: 'A', color: '#custom' }];
    const colors = resolveSeriesColors(series, ['#111']);
    expect(colors.get('a')).toBe('#custom');
  });

  it('cycles the palette when there are more series than colors', () => {
    const series: SeriesConfig[] = [
      { key: 'a', label: 'A' },
      { key: 'b', label: 'B' },
      { key: 'c', label: 'C' },
    ];
    const colors = resolveSeriesColors(series, ['#111', '#222']);
    expect(colors.get('a')).toBe('#111');
    expect(colors.get('b')).toBe('#222');
    expect(colors.get('c')).toBe('#111');
  });

  it('falls back to the default palette when none is given', () => {
    const colors = resolveSeriesColors([{ key: 'a', label: 'A' }]);
    expect(colors.get('a')).toBeTruthy();
  });
});
