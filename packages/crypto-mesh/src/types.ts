/**
 * NEWAX Cryptographic Transit Relay - Type Definitions
 *
 * Implements Zero-Trust Multi-Hop Re-Encryption:
 * Sender encrypts using K_sender -> NeuraCore decrypts with K_sender & re-encrypts with K_receiver -> Receiver decrypts with K_receiver.
 * Neither party ever discovers the other party's cryptographic key.
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

  /** Base64-encoded HMAC-SHA256 signature binding the envelope metadata to prevent tampering */
  signature: string;
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

  /** HMAC secret hex used to sign and verify envelope headers */
  authSecretHex: string;

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
