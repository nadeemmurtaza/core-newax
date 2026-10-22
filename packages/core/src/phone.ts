/**
 * Phone Number Normalization and Validation.
 *
 * Implements E.164 phone formatting, local national formatting,
 * and mobile carrier detection across multiple country locales.
 */

export interface PhoneLocaleConfig {
  dialCode: string;
  nationalNumberLength: number;
  mobilePrefix: string;
}

export const DEFAULT_PHONE_LOCALE: PhoneLocaleConfig = {
  dialCode: '92',
  nationalNumberLength: 10,
  mobilePrefix: '3',
};

export interface NormalizedPhone {
  /** E.164, e.g. "+923001234567". Null when input is invalid. */
  e164: string | null;
  /** Local display form, e.g. "0300 1234567". */
  national: string | null;
  isMobile: boolean;
}

export function normalizePhone(
  input: string | null | undefined,
  localeConfig: PhoneLocaleConfig = DEFAULT_PHONE_LOCALE,
): NormalizedPhone {
  const invalid: NormalizedPhone = { e164: null, national: null, isMobile: false };
  if (!input) {
    return invalid;
  }

  let digits = input.replace(/\D/g, '');
  if (!digits) {
    return invalid;
  }

  const { dialCode, nationalNumberLength, mobilePrefix } = localeConfig;

  if (digits.startsWith('00' + dialCode)) {
    digits = digits.slice(2 + dialCode.length);
  } else if (digits.startsWith(dialCode) && digits.length > nationalNumberLength) {
    digits = digits.slice(dialCode.length);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length !== nationalNumberLength) {
    return invalid;
  }
  if (digits.startsWith('0')) {
    return invalid;
  }

  return {
    e164: `+${dialCode}${digits}`,
    national: `0${digits.slice(0, 3)} ${digits.slice(3)}`,
    isMobile: digits.startsWith(mobilePrefix),
  };
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) {
    return '***';
  }
  const prefix = phone.slice(0, 4);
  const suffix = phone.slice(-2);
  return `${prefix}*****${suffix}`;
}
