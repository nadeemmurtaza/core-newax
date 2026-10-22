import { TransitCipher, CryptographicIntegrityError } from './transit-cipher.js';
import type { ClientEntityCredentials } from './key-vault.js';
import type { EncryptedTransitEnvelope } from './types.js';

/**
 * CryptoMeshClient: Lightweight Zero-Knowledge Client Adapter.
 *
 * Runs inside any service, microservice (e.g. ERP-1, Communicator, nID),
 * or customer client device.
 *
 * Holds ONLY the entity's own cryptographic keys:
 * - ingressSecretHex: 256-bit AES key used to encrypt outbound messages for NeuraCore.
 * - egressSecretHex: 256-bit AES key used to decrypt inbound messages delivered from NeuraCore.
 * - authSecretHex: 512-bit HMAC-SHA512 key used for message integrity.
 * - rsaPrivateKeyPem: optional 4096-bit RSA private key for banking-grade asymmetric signatures.
 *
 * Has ZERO knowledge of recipient keys or other system nodes.
 */
export class CryptoMeshClient {
  constructor(private readonly credentials: ClientEntityCredentials) {}

  get entityId(): string {
    return this.credentials.entityId;
  }

  get tenantId(): string {
    return this.credentials.tenantId;
  }

  /**
   * Encrypts a payload for transmission through NeuraCore to a designated recipient.
   */
  encryptForRelay(recipientId: string, payload: unknown): EncryptedTransitEnvelope {
    return TransitCipher.encrypt(payload, this.credentials.ingressSecretHex, {
      tenantId: this.credentials.tenantId,
      senderId: this.credentials.entityId,
      recipientId,
      keyId: this.credentials.keyId,
      authSecretHex: this.credentials.authSecretHex,
      ...(this.credentials.rsaPrivateKeyPem
        ? { rsaPrivateKeyPem: this.credentials.rsaPrivateKeyPem }
        : {}),
    });
  }

  /**
   * Decrypts an inbound envelope forwarded by NeuraCore.
   */
  decryptFromRelay<T = unknown>(
    envelope: EncryptedTransitEnvelope,
    options?: { neuraCoreRsaPublicKeyPem?: string },
  ): T {
    if (envelope.tenantId !== this.credentials.tenantId) {
      throw new CryptographicIntegrityError(
        `Cross-tenant access violation: message belongs to tenant '${envelope.tenantId}', but client is bound to '${this.credentials.tenantId}'.`,
      );
    }

    if (envelope.recipientId !== this.credentials.entityId) {
      throw new CryptographicIntegrityError(
        `Mismatched recipient: envelope recipient is '${envelope.recipientId}', but this client is '${this.credentials.entityId}'.`,
      );
    }

    return TransitCipher.decrypt<T>(envelope, this.credentials.egressSecretHex, {
      authSecretHex: this.credentials.authSecretHex,
      rsaPublicKeyPem: options?.neuraCoreRsaPublicKeyPem,
      enforceReplayCheck: true,
    });
  }
}
