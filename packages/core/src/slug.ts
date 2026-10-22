/**
 * URL Slug generation and normalization.
 * Supports unicode normalization, transliteration, and collision resolution.
 */

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const SUFFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function randomSuffix(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += SUFFIX_ALPHABET[Math.floor(Math.random() * SUFFIX_ALPHABET.length)];
  }
  return out;
}

/** Slugifies, falling back to `<fallbackPrefix>-<random>` when input is non-Latin/empty. */
export function slugifyWithFallback(input: string, fallbackPrefix = 'item'): string {
  const slug = slugify(input);
  return slug.length > 0 ? slug : `${fallbackPrefix}-${randomSuffix()}`;
}

/** Appends a numeric suffix until the slug is unique among `taken`. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) {
    return base;
  }

  let counter = 2;
  while (used.has(`${base}-${counter}`)) {
    counter += 1;
  }
  return `${base}-${counter}`;
}
