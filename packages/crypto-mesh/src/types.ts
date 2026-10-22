/**
 * NEWAX Cryptographic Transit Relay - Type Definitions
 *
 * Implements Banking-Grade Multi-Layer Zero-Trust Re-Encryption:
 * - Layer 1: RSA-4096 Asymmetric Identity Binding & Envelope Sealing (Largest known standard asymmetric key size).
 * - Layer 2: AES-256-GCM Authenticated Encryption with 12-byte cryptographically random IV (Largest symmetric key size).
 * - Layer 3: 512-bit HMAC-SHA512 Canonical Envelope Integrity Signature (Largest standard secure hashing algorithm).
 * - Layer 4: HKDF-SHA512 Ephemeral Session Key Derivation for Perfect Forward Secrecy.
 *
 * SENDER AND RECEIVER HAVE STRICTLY SEPARATE KEYS.
 * NeuraCore acts as the sovereign cryptographic bridge.
 * Neither party ever discovers or accesses the other party's keys.
 */

export interface EncryptedTransitEnvelope {
  /** Protocol envelope specification version */
  version: '1.0.0';

  /** Multi-tenant isolation partition identifier */
  tenantId: string;

  /** Sender entity identifier (e.g. 'erp-1', 'communicator', 'cust-device-xyz') */
  senderId: string;

  /** Destination recipient entity identifier */
  recipientId: string;

  /** Base64-encoded 12-byte initialization vector (AES-GCM nonce) */
  iv: string;

  /** Base64-encoded AES-256-GCM ciphertext */
  ciphertext: string;

  /** Base64-encoded 16-byte authentication tag (AEAD verification) */
  authTag: string;

  /** Identifier of the key version used by the sender */
  keyId: string;

  /** UTC ISO-8601 timestamp of message creation (used for anti-replay enforcement) */
  timestamp: string;

  /** Base64-encoded 512-bit HMAC-SHA512 signature binding envelope metadata */
  signature: string;

  /** Optional RSA-4096 asymmetric signature for high-value financial / banking-grade operations */
  asymmetricSignature?: string;
}

export interface EntityKeyRecord {
  /** Unique entity identifier within the tenant */
  entityId: string;

  /** Multi-tenant partition */
  tenantId: string;

  /** Key identifier */
  keyId: string;

  /** 256-bit AES hex key used by this entity to encrypt data sent to NeuraCore */
  ingressSecretHex: string;

  /** 256-bit AES hex key used by NeuraCore to encrypt data delivered to this entity */
  egressSecretHex: string;

  /** 512-bit HMAC-SHA512 secret hex used to sign and verify envelope headers (64 bytes = 128 hex chars) */
  authSecretHex: string;

  /** 4096-bit RSA Public Key PEM for asymmetric envelope sealing and verification */
  rsaPublicKeyPem?: string;

  /** 4096-bit RSA Private Key PEM (Held exclusively by the entity, never shared) */
  rsaPrivateKeyPem?: string;

  /** Revocation status */
  revoked: boolean;

  /** Timestamp of key enrollment */
  createdAt: string;
}

export interface RelayOptions {
  /** Optional synchronous or asynchronous payload translation/enrichment hook in NeuraCore */
  translatePayload?: (plaintext: unknown) => unknown | Promise<unknown>;

  /** Maximum allowed clock drift in seconds before rejecting as replay attack (default: 300) */
  maxClockSkewSeconds?: number;

  /** Audit context metadata for logging and compliance */
  auditContext?: {
    requestId?: string;
    action?: string;
  };
}

export interface RelayResult {
  /** Re-encrypted envelope addressed to the recipient, encrypted with recipient's egressKey */
  egressEnvelope: EncryptedTransitEnvelope;

  /** Cryptographic execution metrics */
  ingressDecryptionMs: number;
  egressEncryptionMs: number;
  totalRelayMs: number;
}
