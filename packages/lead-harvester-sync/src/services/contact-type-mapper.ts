import type { ContactType } from '@newax/contacts';

const SUPPORTED_CONTACT_TYPES: ReadonlySet<string> = new Set([
  'email',
  'phone',
  'whatsapp',
  'telegram',
]);

/**
 * Harvester's contact_type is a free-text column, not an enum -- values
 * outside the supported set (e.g. "linkedin") return null so the caller can
 * skip-and-log that one contact point without failing the rest of the
 * payload.
 */
export function mapHarvesterContactType(value: string): ContactType | null {
  const normalized = value.trim().toLowerCase();
  return SUPPORTED_CONTACT_TYPES.has(normalized) ? (normalized as ContactType) : null;
}
