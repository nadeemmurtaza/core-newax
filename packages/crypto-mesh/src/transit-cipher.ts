import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { EncryptedTransitEnvelope } from './types.js';

export class CryptographicIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptographicIntegrityError';
  }
}

export class ReplayAttackDetectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayAttackDetectedError';
  }
}

export class TransitCipher {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH_BYTES = 12;
  private static readonly AUTH_TAG_LENGTH_BYTES = 16;

  /**
   * Computes additional authenticated data (AAD) string to cryptographically bind
   * the payload ciphertext to the routing headers and timestamp.
   */
  private static buildAad(envelope: {
    version: string;
    tenantId: string;
    senderId: string;
    recipientId: string;
    keyId: string;
    timestamp: string;
  }): Buffer {
    return Buffer.from(
      `${envelope.version}:${envelope.tenantId}:${envelope.senderId}:${envelope.recipientId}:${envelope.keyId}:${envelope.timestamp}`,
      'utf8',
    );
  }

  /**
   * Computes an HMAC-SHA256 signature across the entire envelope to guarantee message authenticity.
   */
  static computeSignature(
    metadata: Omit<EncryptedTransitEnvelope, 'signature'>,
    authSecretHex: string,
  ): string {
    const canonicalString = [
      metadata.version,
      metadata.tenantId,
      metadata.senderId,
      metadata.recipientId,
      metadata.keyId,
      metadata.timestamp,
      metadata.iv,
      metadata.authTag,
      metadata.ciphertext,
    ].join('|');

    const hmac = createHmac('sha256', Buffer.from(authSecretHex, 'hex'));
    hmac.update(canonicalString, 'utf8');
    return hmac.digest('base64');
  }

  /**
   * Encrypts a plaintext payload using AES-256-GCM with authenticated headers and HMAC signature.
   */
  static encrypt(
    payload: unknown,
    secretHex: string,
    params: {
      tenantId: string;
      senderId: string;
      recipientId: string;
      keyId: string;
      authSecretHex: string;
      customTimestamp?: string;
    },
  ): EncryptedTransitEnvelope {
    const key = Buffer.from(secretHex, 'hex');
    if (key.length !== 32) {
      throw new Error(`Invalid AES-256 key length: expected 32 bytes (64 hex characters), received ${key.length} bytes.`);
    }

    const iv = randomBytes(this.IV_LENGTH_BYTES);
    const timestamp = params.customTimestamp ?? new Date().toISOString();

    const aad = this.buildAad({
      version: '1.0.0',
      tenantId: params.tenantId,
      senderId: params.senderId,
      recipientId: params.recipientId,
      keyId: params.keyId,
      timestamp,
    });

    const cipher = createCipheriv(this.ALGORITHM, key, iv, {
      authTagLength: this.AUTH_TAG_LENGTH_BYTES,
    });
    cipher.setAAD(aad);

    const serialized = JSON.stringify(payload);
    const encrypted = Buffer.concat([cipher.update(serialized, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const envelopeWithoutSig: Omit<EncryptedTransitEnvelope, 'signature'> = {
      version: '1.0.0',
      tenantId: params.tenantId,
      senderId: params.senderId,
      recipientId: params.recipientId,
      iv: iv.toString('base64'),
      ciphertext: encrypted.toString('base64'),
      authTag: authTag.toString('base64'),
      keyId: params.keyId,
      timestamp,
    };

    const signature = this.computeSignature(envelopeWithoutSig, params.authSecretHex);

    return {
      ...envelopeWithoutSig,
      signature,
    };
  }

  /**
   * Decrypts an EncryptedTransitEnvelope, strictly verifying AEAD authentication tags,
   * HMAC signature, and anti-replay timestamps.
   */
  static decrypt<T = unknown>(
    envelope: EncryptedTransitEnvelope,
    secretHex: string,
    options?: {
      authSecretHex?: string;
      maxClockSkewSeconds?: number;
      enforceReplayCheck?: boolean;
    },
  ): T {
    // 1. Replay attack verification
    const maxSkew = options?.maxClockSkewSeconds ?? 300;
    const nowMs = Date.now();
    const envelopeTimeMs = new Date(envelope.timestamp).getTime();

    if (isNaN(envelopeTimeMs)) {
      throw new CryptographicIntegrityError('Malformed envelope timestamp: invalid ISO format.');
    }

    if (options?.enforceReplayCheck !== false) {
      const skewSeconds = Math.abs(nowMs - envelopeTimeMs) / 1000;
      if (skewSeconds > maxSkew) {
        throw new ReplayAttackDetectedError(
          `Replay attack prevented: envelope timestamp delta (${skewSeconds.toFixed(1)}s) exceeds max threshold (${maxSkew}s).`,
        );
      }
    }

    // 2. Signature verification
    if (options?.authSecretHex) {
      const { signature, ...metadata } = envelope;
      const expectedSignature = this.computeSignature(metadata, options.authSecretHex);

      const sigBuffer = Buffer.from(signature, 'base64');
      const expectedSigBuffer = Buffer.from(expectedSignature, 'base64');

      if (
        sigBuffer.length !== expectedSigBuffer.length ||
        !timingSafeEqual(sigBuffer, expectedSigBuffer)
      ) {
        throw new CryptographicIntegrityError(
          'Envelope signature verification failed: message has been tampered with on the wire.',
        );
      }
    }

    // 3. AES-256-GCM AEAD Decryption
    const key = Buffer.from(secretHex, 'hex');
    const iv = Buffer.from(envelope.iv, 'base64');
    const authTag = Buffer.from(envelope.authTag, 'base64');
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64');

    const aad = this.buildAad({
      version: envelope.version,
      tenantId: envelope.tenantId,
      senderId: envelope.senderId,
      recipientId: envelope.recipientId,
      keyId: envelope.keyId,
      timestamp: envelope.timestamp,
    });

    try {
      const decipher = createDecipheriv(this.ALGORITHM, key, iv, {
        authTagLength: this.AUTH_TAG_LENGTH_BYTES,
      });
      decipher.setAAD(aad);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return JSON.parse(decrypted.toString('utf8')) as T;
    } catch (err) {
      throw new CryptographicIntegrityError(
        `Ciphertext decryption failed: AEAD authentication tag mismatch or invalid encryption key. Error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
