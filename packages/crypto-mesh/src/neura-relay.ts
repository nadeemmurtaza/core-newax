import { TransitCipher, ReplayAttackDetectedError } from './transit-cipher.js';
import type { NeuraKeyVault } from './key-vault.js';
import type { EncryptedTransitEnvelope, RelayOptions, RelayResult } from './types.js';

/**
 * NeuraCryptoRelay: The Central Sovereign Cryptographic Bridge in NeuraCore.
 *
 * Enforces Zero-Trust Dual-Key Cryptographic Isolation:
 * - Sender encrypts payload with its own secret (K_sender).
 * - NeuraCore receives ciphertext over the wire, validates signature and freshness.
 * - NeuraCore decrypts with K_sender, performs optional translation/governance audit.
 * - NeuraCore re-encrypts with the destination recipient's unique secret (K_receiver).
 * - NeuraCore forwards the new ciphertext to the recipient.
 *
 * Sender never knows K_receiver. Receiver never knows K_sender.
 * Attackers intercepting packets on transmission lines see only opaque AES-256-GCM ciphertext.
 */
export class NeuraCryptoRelay {
  private readonly seenSignatures = new Map<string, number>();

  constructor(private readonly keyVault: NeuraKeyVault) {}

  /**
   * Cleans expired anti-replay nonces from the replay cache.
   */
  private sweepReplayCache(maxAgeSeconds: number = 300): void {
    const cutoff = Date.now() - maxAgeSeconds * 1000;
    for (const [sig, timestamp] of this.seenSignatures.entries()) {
      if (timestamp < cutoff) {
        this.seenSignatures.delete(sig);
      }
    }
  }

  /**
   * Receives an encrypted transit envelope, verifies authenticity, trans-encrypts,
   * and prepares the outgoing encrypted envelope for the recipient.
   */
  async relayMessage(
    incomingEnvelope: EncryptedTransitEnvelope,
    options?: RelayOptions,
  ): Promise<RelayResult> {
    const totalStart = Date.now();
    const maxSkew = options?.maxClockSkewSeconds ?? 300;

    // 1. Sweep expired nonces and verify replay protection
    this.sweepReplayCache(maxSkew);
    if (this.seenSignatures.has(incomingEnvelope.signature)) {
      throw new ReplayAttackDetectedError(
        `Replay attack intercepted: transit envelope signature '${incomingEnvelope.signature.slice(0, 16)}...' has already been processed.`,
      );
    }
    this.seenSignatures.set(incomingEnvelope.signature, Date.now());

    // 2. Multi-tenant sender verification & key retrieval
    const senderRecord = this.keyVault.getEntityRecord(
      incomingEnvelope.tenantId,
      incomingEnvelope.senderId,
    );

    // 3. Ingress Decryption with Sender's Ingress Key (K_sender)
    const ingressStart = Date.now();
    let plaintextPayload = TransitCipher.decrypt(
      incomingEnvelope,
      senderRecord.ingressSecretHex,
      {
        authSecretHex: senderRecord.authSecretHex,
        maxClockSkewSeconds: maxSkew,
        enforceReplayCheck: true,
      },
    );
    const ingressDecryptionMs = Math.max(0.1, Date.now() - ingressStart);

    // 4. Optional Translation & Routing Logic in NeuraCore
    if (options?.translatePayload) {
      plaintextPayload = await options.translatePayload(plaintextPayload);
    }

    // 5. Multi-tenant recipient verification & key retrieval
    const recipientRecord = this.keyVault.getEntityRecord(
      incomingEnvelope.tenantId,
      incomingEnvelope.recipientId,
    );

    // 6. Egress Re-Encryption with Recipient's Egress Key (K_receiver)
    const egressStart = Date.now();
    const egressEnvelope = TransitCipher.encrypt(
      plaintextPayload,
      recipientRecord.egressSecretHex,
      {
        tenantId: incomingEnvelope.tenantId,
        senderId: incomingEnvelope.senderId,
        recipientId: incomingEnvelope.recipientId,
        keyId: recipientRecord.keyId,
        authSecretHex: recipientRecord.authSecretHex,
      },
    );
    const egressEncryptionMs = Math.max(0.1, Date.now() - egressStart);

    // 7. Plaintext scrubbing
    plaintextPayload = null;

    const totalRelayMs = Math.max(0.1, Date.now() - totalStart);

    return {
      egressEnvelope,
      ingressDecryptionMs,
      egressEncryptionMs,
      totalRelayMs,
    };
  }
}
