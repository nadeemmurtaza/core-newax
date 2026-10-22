/**
 * Precision Financial Calculations using Minor Currency Units (Paisa / Cents).
 *
 * Avoids IEEE 754 floating-point inaccuracies by storing all monetary amounts
 * as integers in the lowest denomination (minor units).
 */

export function minorToMajor(amountMinor: number): number {
  return amountMinor / 100;
}

export function majorToMinor(amountMajor: number): number {
  return Math.round(amountMajor * 100);
}

export function formatCurrency(amountMinor: number, currency = 'PKR', locale = 'en-PK'): string {
  const major = minorToMajor(amountMinor);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);
}

export function addMoney(aMinor: number, bMinor: number): number {
  return aMinor + bMinor;
}

export function subtractMoney(aMinor: number, bMinor: number): number {
  return aMinor - bMinor;
}

export function multiplyMoney(aMinor: number, multiplier: number): number {
  return Math.round(aMinor * multiplier);
}
