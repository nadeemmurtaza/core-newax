import { describe, expect, it } from 'vitest';
import { contrastRatioHex, wcagLevel } from '../src/contrast';

describe('contrast maths', () => {
  it('matches the published WCAG vectors', () => {
    expect(contrastRatioHex('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatioHex('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
    expect(contrastRatioHex('#ffffff', '#ffffff')).toBe(1);
  });

  it('labels a ratio by the conformance level it reaches', () => {
    expect(wcagLevel(7.5)).toBe('AAA');
    expect(wcagLevel(4.6)).toBe('AA');
    expect(wcagLevel(4.4)).toBe('fail');
    // Large text has the lower floors: 3:1 is AA, 4.5:1 is AAA.
    expect(wcagLevel(3.2, true)).toBe('AA');
    expect(wcagLevel(4.6, true)).toBe('AAA');
  });
});
