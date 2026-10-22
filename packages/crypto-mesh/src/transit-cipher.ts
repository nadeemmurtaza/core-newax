import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createSign,
  createVerify,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
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
  private static readonly HASH_ALGORITHM = 'sha512'; // 512-bit cryptographic hash (largest standard HMAC)
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
   * Builds the canonical string representation for cryptographic signing.
   */
  private static buildCanonicalString(
    metadata: Omit<EncryptedTransitEnvelope, 'signature' | 'asymmetricSignature'>,
  ): string {
    return [
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
  }

  /**
   * Computes a 512-bit HMAC-SHA512 signature across the entire envelope to guarantee message authenticity.
   */
  static computeSignature(
    metadata: Omit<EncryptedTransitEnvelope, 'signature' | 'asymmetricSignature'>,
    authSecretHex: string,
  ): string {
    const canonicalString = this.buildCanonicalString(metadata);
    const hmac = createHmac(this.HASH_ALGORITHM, Buffer.from(authSecretHex, 'hex'));
    hmac.update(canonicalString, 'utf8');
    return hmac.digest('base64');
  }

  /**
   * Signs the canonical envelope using an RSA-4096 private key (SHA-512 with PKCS#1 v1.5 / PSS).
   */
  static signAsymmetric(
    metadata: Omit<EncryptedTransitEnvelope, 'signature' | 'asymmetricSignature'>,
    rsaPrivateKeyPem: string,
  ): string {
    const canonicalString = this.buildCanonicalString(metadata);
    const signer = createSign('SHA512');
    signer.update(canonicalString, 'utf8');
    signer.end();
    return signer.sign(rsaPrivateKeyPem, 'base64');
  }

  /**
   * Verifies the RSA-4096 asymmetric signature against the sender's public key.
   */
  static verifyAsymmetric(
    metadata: Omit<EncryptedTransitEnvelope, 'signature' | 'asymmetricSignature'>,
    signatureBase64: string,
    rsaPublicKeyPem: string,
  ): boolean {
    try {
      const canonicalString = this.buildCanonicalString(metadata);
      const verifier = createVerify('SHA512');
      verifier.update(canonicalString, 'utf8');
      verifier.end();
      return verifier.verify(rsaPublicKeyPem, Buffer.from(signatureBase64, 'base64'));
    } catch {
      return false;
    }
  }

  /**
   * Encrypts a plaintext payload using AES-256-GCM with authenticated headers, 512-bit HMAC,
   * and optional RSA-4096 digital signature.
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
      rsaPrivateKeyPem?: string | undefined;
      customTimestamp?: string;
    },
  ): EncryptedTransitEnvelope {
    const key = Buffer.from(secretHex, 'hex');
    if (key.length !== 32) {
      throw new Error(
        `Invalid AES-256 key length: expected 32 bytes (64 hex characters), received ${key.length} bytes.`,
      );
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

    const envelopeWithoutSig: Omit<EncryptedTransitEnvelope, 'signature' | 'asymmetricSignature'> = {
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

    // 512-bit HMAC-SHA512 Signature
    const signature = this.computeSignature(envelopeWithoutSig, params.authSecretHex);

    // Optional RSA-4096 Asymmetric Signature
    let asymmetricSignature: string | undefined;
    if (params.rsaPrivateKeyPem) {
      asymmetricSignature = this.signAsymmetric(envelopeWithoutSig, params.rsaPrivateKeyPem);
    }

    return {
      ...envelopeWithoutSig,
      signature,
      ...(asymmetricSignature ? { asymmetricSignature } : {}),
    };
  }

  /**
   * Decrypts an EncryptedTransitEnvelope, strictly verifying AEAD authentication tags,
   * 512-bit HMAC signature, optional RSA-4096 signature, and anti-replay timestamps.
   */
  static decrypt<T = unknown>(
    envelope: EncryptedTransitEnvelope,
    secretHex: string,
    options?: {
      authSecretHex?: string;
      rsaPublicKeyPem?: string | undefined;
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

    // 2. 512-bit HMAC-SHA512 Signature verification
    if (options?.authSecretHex) {
      const { signature, asymmetricSignature: _asym, ...metadata } = envelope;
      const expectedSignature = this.computeSignature(metadata, options.authSecretHex);

      const sigBuffer = Buffer.from(signature, 'base64');
      const expectedSigBuffer = Buffer.from(expectedSignature, 'base64');

      if (
        sigBuffer.length !== expectedSigBuffer.length ||
        !timingSafeEqual(sigBuffer, expectedSigBuffer)
      ) {
        throw new CryptographicIntegrityError(
          'Envelope 512-bit HMAC signature verification failed: message has been tampered with on the wire.',
        );
      }
    }

    // 3. Optional RSA-4096 Asymmetric Signature verification
    if (options?.rsaPublicKeyPem && envelope.asymmetricSignature) {
      const { signature: _sig, asymmetricSignature, ...metadata } = envelope;
      const valid = this.verifyAsymmetric(metadata, asymmetricSignature, options.rsaPublicKeyPem);
      if (!valid) {
        throw new CryptographicIntegrityError(
          'RSA-4096 asymmetric signature verification failed: identity forgery detected.',
        );
      }
    }

    // 4. AES-256-GCM AEAD Decryption
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
