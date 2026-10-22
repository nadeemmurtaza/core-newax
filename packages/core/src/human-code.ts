/**
 * Human-Readable High-Entropy Random Codes.
 *
 * Avoids visual ambiguity by omitting 0/O, 1/I/l.
 * Cross-platform compatible with both Node and browser runtimes.
 */

const UNAMBIGUOUS_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomByte(): number {
  return globalThis.crypto.getRandomValues(new Uint8Array(1))[0]!;
}

function randomIndex(max: number): number {
  const limit = 256 - (256 % max);
  let byte = randomByte();
  while (byte >= limit) {
    byte = randomByte();
  }
  return byte % max;
}

export function generateHumanCode(length = 8): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += UNAMBIGUOUS_ALPHABET[randomIndex(UNAMBIGUOUS_ALPHABET.length)];
  }
  return code;
}

export function formatOrderReference(tenantPrefix: string, sequenceNumber: number): string {
  const seqStr = String(sequenceNumber).padStart(5, '0');
  const check = generateHumanCode(2);
  return `${tenantPrefix.toUpperCase()}-${seqStr}-${check}`;
}
