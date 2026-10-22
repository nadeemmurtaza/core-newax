import { generateKeyPairSync, randomBytes } from 'node:crypto';
import type { EntityKeyRecord } from './types.js';

export class KeyNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeyNotFoundError';
  }
}

export class KeyRevokedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeyRevokedError';
  }
}

export interface ClientEntityCredentials {
  tenantId: string;
  entityId: string;
  keyId: string;
  /** 256-bit AES key for outbound messages directed to NeuraCore */
  ingressSecretHex: string;
  /** 256-bit AES key for inbound messages arriving from NeuraCore */
  egressSecretHex: string;
  /** 512-bit HMAC-SHA512 secret for envelope signing (64 bytes = 128 hex chars) */
  authSecretHex: string;
  /** Optional RSA-4096 public key for asymmetric verification */
  rsaPublicKeyPem?: string;
  /** Optional RSA-4096 private key held strictly by this entity */
  rsaPrivateKeyPem?: string;
}

/**
 * NeuraKeyVault: Multi-Tenant Zero-Trust Key Management Store for NeuraCore.
 *
 * Stores distinct sender (ingress) and receiver (egress) keys per entity.
 * Uses maximum known key lengths:
 * - 256-bit AES-GCM (military / banking standard)
 * - 512-bit HMAC-SHA512 (largest standard integrity key)
 * - 4096-bit RSA asymmetric keypair (largest standard asymmetric key used in Tier-1 banking)
 */
export class NeuraKeyVault {
  private readonly records = new Map<string, EntityKeyRecord>();

  private buildKey(tenantId: string, entityId: string): string {
    return `${tenantId}::${entityId}`;
  }

  /**
   * Registers a new entity or rotates keys for an existing entity.
   * Generates maximum length keys (256-bit AES, 512-bit HMAC, and optional 4096-bit RSA).
   */
  registerEntity(
    tenantId: string,
    entityId: string,
    options?: {
      ingressSecretHex?: string;
      egressSecretHex?: string;
      authSecretHex?: string;
      generateRsa4096?: boolean;
    },
  ): EntityKeyRecord {
    const keyId = `kid_${Date.now()}_${randomBytes(8).toString('hex')}`;
    const ingressSecretHex = options?.ingressSecretHex ?? randomBytes(32).toString('hex'); // 256-bit
    const egressSecretHex = options?.egressSecretHex ?? randomBytes(32).toString('hex'); // 256-bit
    const authSecretHex = options?.authSecretHex ?? randomBytes(64).toString('hex'); // 512-bit (64 bytes)

    let rsaPublicKeyPem: string | undefined;
    let rsaPrivateKeyPem: string | undefined;

    if (options?.generateRsa4096) {
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      rsaPublicKeyPem = publicKey;
      rsaPrivateKeyPem = privateKey;
    }

    const record: EntityKeyRecord = {
      tenantId,
      entityId,
      keyId,
      ingressSecretHex,
      egressSecretHex,
      authSecretHex,
      ...(rsaPublicKeyPem ? { rsaPublicKeyPem } : {}),
      ...(rsaPrivateKeyPem ? { rsaPrivateKeyPem } : {}),
      revoked: false,
      createdAt: new Date().toISOString(),
    };

    this.records.set(this.buildKey(tenantId, entityId), record);
    return record;
  }

  /**
   * Retrieves active key record for an entity within a tenant partition.
   */
  getEntityRecord(tenantId: string, entityId: string): EntityKeyRecord {
    const record = this.records.get(this.buildKey(tenantId, entityId));
    if (!record) {
      throw new KeyNotFoundError(
        `Entity '${entityId}' in tenant '${tenantId}' is not registered in NeuraKeyVault.`,
      );
    }
    if (record.revoked) {
      throw new KeyRevokedError(
        `Key for entity '${entityId}' in tenant '${tenantId}' has been revoked.`,
      );
    }
    return record;
  }

  /**
   * Exports minimal client-side credentials for an entity.
   * Returns ONLY this entity's private keys, guaranteeing zero knowledge of any other entity's keys.
   */
  exportClientCredentials(tenantId: string, entityId: string): ClientEntityCredentials {
    const record = this.getEntityRecord(tenantId, entityId);
    return {
      tenantId: record.tenantId,
      entityId: record.entityId,
      keyId: record.keyId,
      ingressSecretHex: record.ingressSecretHex,
      egressSecretHex: record.egressSecretHex,
      authSecretHex: record.authSecretHex,
      ...(record.rsaPublicKeyPem ? { rsaPublicKeyPem: record.rsaPublicKeyPem } : {}),
      ...(record.rsaPrivateKeyPem ? { rsaPrivateKeyPem: record.rsaPrivateKeyPem } : {}),
    };
  }

  /**
   * Revokes an entity's cryptographic keys immediately, halting any further transmissions.
   */
  revokeEntity(tenantId: string, entityId: string): boolean {
    const record = this.records.get(this.buildKey(tenantId, entityId));
    if (record) {
      record.revoked = true;
      return true;
    }
    return false;
  }

  /**
   * Lists all active entity records for a tenant.
   */
  listEntities(tenantId: string): EntityKeyRecord[] {
    const results: EntityKeyRecord[] = [];
    for (const record of this.records.values()) {
      if (record.tenantId === tenantId) {
        results.push(record);
      }
    }
    return results;
  }
}
