import { describe, expect, it } from 'vitest';
import { formatChartValue } from '../src/formatters';

describe('formatChartValue', () => {
  it('formats a plain number', () => {
    expect(formatChartValue(1234.5)).toBe('1,234.5');
  });

  it('formats currency', () => {
    expect(formatChartValue(1234, 'currency')).toBe('$1,234');
  });

  it('formats percent', () => {
    expect(formatChartValue(0.456, 'percent')).toBe('45.6%');
  });

  it('formats compact', () => {
    expect(formatChartValue(1_500_000, 'compact')).toBe('1.5M');
  });

  it('formats integer, dropping decimals', () => {
    expect(formatChartValue(42.9, 'integer')).toBe('43');
  });

  it('respects a custom currency code', () => {
    expect(formatChartValue(100, 'currency', { currency: 'EUR' })).toContain('100');
  });
});
