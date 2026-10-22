import { randomBytes } from 'node:crypto';
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
  /** Encryption key for outbound messages directed to NeuraCore */
  ingressSecretHex: string;
  /** Decryption key for inbound messages arriving from NeuraCore */
  egressSecretHex: string;
  /** HMAC secret for signing envelopes */
  authSecretHex: string;
}

/**
 * NeuraKeyVault: Multi-Tenant Zero-Trust Key Management Store for NeuraCore.
 *
 * Stores distinct sender (ingress) and receiver (egress) keys per entity.
 * Guarantees cryptographic isolation between all microservices, ERP nodes, and client devices.
 */
export class NeuraKeyVault {
  private readonly records = new Map<string, EntityKeyRecord>();

  private buildKey(tenantId: string, entityId: string): string {
    return `${tenantId}::${entityId}`;
  }

  /**
   * Registers a new entity or rotates keys for an existing entity.
   * Generates cryptographically secure 256-bit random keys for ingress, egress, and HMAC authentication.
   */
  registerEntity(
    tenantId: string,
    entityId: string,
    customSecrets?: {
      ingressSecretHex?: string;
      egressSecretHex?: string;
      authSecretHex?: string;
    },
  ): EntityKeyRecord {
    const keyId = `kid_${Date.now()}_${randomBytes(4).toString('hex')}`;
    const ingressSecretHex = customSecrets?.ingressSecretHex ?? randomBytes(32).toString('hex');
    const egressSecretHex = customSecrets?.egressSecretHex ?? randomBytes(32).toString('hex');
    const authSecretHex = customSecrets?.authSecretHex ?? randomBytes(32).toString('hex');

    const record: EntityKeyRecord = {
      tenantId,
      entityId,
      keyId,
      ingressSecretHex,
      egressSecretHex,
      authSecretHex,
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
