import { describe, expect, it } from 'vitest';
import {
  normalizePhone,
  isValidE164,
  maskPhone,
  slugify,
  slugifyWithFallback,
  uniqueSlug,
  generateHumanCode,
  formatOrderReference,
  minorToMajor,
  majorToMinor,
  formatCurrency,
  addMoney,
  subtractMoney,
  multiplyMoney,
} from '../src/index.js';

describe('@newax/core foundation tests', () => {
  it('normalizes local phone numbers to E.164 and formats national display', () => {
    const res = normalizePhone('0300 1234567');
    expect(res.e164).toBe('+923001234567');
    expect(res.national).toBe('0300 1234567');
    expect(res.isMobile).toBe(true);

    const intl = normalizePhone('+92 321 9876543');
    expect(intl.e164).toBe('+923219876543');
    expect(intl.isMobile).toBe(true);

    expect(isValidE164('+923001234567')).toBe(true);
    expect(isValidE164('invalid')).toBe(false);
    expect(maskPhone('+923001234567')).toBe('+923*****67');
  });

  it('generates clean SEO slugs and handles unicode transliteration', () => {
    expect(slugify('Summer Lawn Collection 2026!')).toBe('summer-lawn-collection-2026');
    expect(slugifyWithFallback('', 'product')).toMatch(/^product-[a-z0-9]{6}$/);
    expect(uniqueSlug('lawn-suit', ['lawn-suit'])).toBe('lawn-suit-2');
  });

  it('generates high-entropy unambiguous human codes', () => {
    const code = generateHumanCode(8);
    expect(code).toHaveLength(8);
    expect(code).not.toMatch(/[0O1Il]/);

    const orderRef = formatOrderReference('YAS', 1042);
    expect(orderRef).toMatch(/^YAS-01042-[A-Z0-9]{2}$/);
  });

  it('handles minor monetary unit arithmetic with integer precision', () => {
    expect(minorToMajor(150000)).toBe(1500.0);
    expect(majorToMinor(1500.5)).toBe(150050);
    expect(addMoney(100, 250)).toBe(350);
    expect(subtractMoney(500, 150)).toBe(350);
    expect(multiplyMoney(1000, 1.15)).toBe(1150);
    expect(formatCurrency(250000)).toContain('2,500.00');
  });
});
