import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  NeuraKeyVault,
  NeuraCryptoRelay,
  CryptoMeshClient,
  TransitCipher,
  CryptographicIntegrityError,
  ReplayAttackDetectedError,
} from '../dist/index.js';

describe('NEWAX Crypto-Mesh: Zero-Trust Multi-Hop Re-Encryption Bridge', () => {
  const tenantId = 'tenant-enterprise-omega';
  const vault = new NeuraKeyVault();

  // Register three distinct entities with distinct keys
  vault.registerEntity(tenantId, 'erp-1');
  vault.registerEntity(tenantId, 'communicator');
  vault.registerEntity(tenantId, 'customer-mobile-app');

  const erpClient = new CryptoMeshClient(vault.exportClientCredentials(tenantId, 'erp-1'));
  const communicatorClient = new CryptoMeshClient(vault.exportClientCredentials(tenantId, 'communicator'));
  const mobileClient = new CryptoMeshClient(vault.exportClientCredentials(tenantId, 'customer-mobile-app'));

  const relay = new NeuraCryptoRelay(vault);

  it('guarantees different keys for sender and receiver', () => {
    const erpCreds = vault.exportClientCredentials(tenantId, 'erp-1');
    const commCreds = vault.exportClientCredentials(tenantId, 'communicator');

    assert.notStrictEqual(erpCreds.ingressSecretHex, commCreds.ingressSecretHex);
    assert.notStrictEqual(erpCreds.egressSecretHex, commCreds.egressSecretHex);
    assert.notStrictEqual(erpCreds.authSecretHex, commCreds.authSecretHex);
  });

  it('successfully relays encrypted messages from ERP to Communicator through NeuraCore', async () => {
    const originalPayload = {
      orderId: 'ord_998877',
      customerPhone: '+923001234567',
      refundStatus: 'PENDING_LIVE_PROOF',
      claimAmountMinor: 1500000,
    };

    // 1. ERP encrypts message for Communicator using ERP's ingress key
    const senderEnvelope = erpClient.encryptForRelay('communicator', originalPayload);

    // Verify wire payload is encrypted
    assert.ok(senderEnvelope.ciphertext);
    assert.notStrictEqual(senderEnvelope.ciphertext, JSON.stringify(originalPayload));
    assert.strictEqual(senderEnvelope.senderId, 'erp-1');
    assert.strictEqual(senderEnvelope.recipientId, 'communicator');

    // 2. Wire transmission to NeuraCore -> NeuraCore trans-encrypts
    const relayResult = await relay.relayMessage(senderEnvelope);
    const receiverEnvelope = relayResult.egressEnvelope;

    // Verify envelope was re-encrypted with receiver's key
    assert.notStrictEqual(senderEnvelope.ciphertext, receiverEnvelope.ciphertext);
    assert.notStrictEqual(senderEnvelope.iv, receiverEnvelope.iv);

    // 3. Communicator receives and decrypts using Communicator's egress key
    const decryptedPayload = communicatorClient.decryptFromRelay(receiverEnvelope);

    assert.deepStrictEqual(decryptedPayload, originalPayload);
    assert.ok(relayResult.totalRelayMs < 100.0, `Relay too slow: ${relayResult.totalRelayMs}ms`);
  });

  it('prohibits receiver from directly decrypting sender envelope without NeuraCore', () => {
    const secretPayload = { confidentialTradeData: 'ALPHA_ZERO_STOCK_SIGNALS' };
    const senderEnvelope = erpClient.encryptForRelay('communicator', secretPayload);

    // If an attacker on the wire gives sender's envelope directly to communicator:
    assert.throws(() => {
      communicatorClient.decryptFromRelay(senderEnvelope);
    }, CryptographicIntegrityError);
  });

  it('prevents sender from decrypting the egress envelope forwarded to receiver', () => {
    const secretPayload = { valuationSignal: 'PKR_250M_EBITDA' };
    const senderEnvelope = erpClient.encryptForRelay('communicator', secretPayload);

    relay.relayMessage(senderEnvelope).then((res) => {
      assert.throws(() => {
        erpClient.decryptFromRelay(res.egressEnvelope);
      }, CryptographicIntegrityError);
    });
  });

  it('detects tampering on the transmission line and rejects modified ciphertext', async () => {
    const originalPayload = { paymentAmount: 500000 };
    const envelope = erpClient.encryptForRelay('communicator', originalPayload);

    // Simulate attacker flipping bits in ciphertext on the network wire
    const rawCiphertextBuffer = Buffer.from(envelope.ciphertext, 'base64');
    rawCiphertextBuffer[0] = (rawCiphertextBuffer[0] || 0) ^ 0xff;
    const tamperedEnvelope = {
      ...envelope,
      ciphertext: rawCiphertextBuffer.toString('base64'),
    };

    await assert.rejects(async () => {
      await relay.relayMessage(tamperedEnvelope);
    }, CryptographicIntegrityError);
  });

  it('enforces anti-replay protection and halts duplicated transit envelopes', async () => {
    const payload = { eventId: 'unique_transaction_001' };
    const envelope = mobileClient.encryptForRelay('erp-1', payload);

    // First delivery succeeds
    const firstRelay = await relay.relayMessage(envelope);
    assert.ok(firstRelay.egressEnvelope);

    // Replay attempt on the wire by an attacker must be immediately blocked
    await assert.rejects(async () => {
      await relay.relayMessage(envelope);
    }, ReplayAttackDetectedError);
  });

  it('enables in-transit message transformation and governance auditing in NeuraCore', async () => {
    const incomingData = { rawClaim: 'DAMAGED_IPHONE_15_PRO' };
    const envelope = mobileClient.encryptForRelay('communicator', incomingData);

    const relayResult = await relay.relayMessage(envelope, {
      translatePayload: (payload) => {
        return {
          ...payload,
          neuraCoreEnrichment: {
            fraudScrutinyRequired: true,
            auditTimestamp: '2026-10-22T12:00:00Z',
          },
        };
      },
    });

    const finalOutput = communicatorClient.decryptFromRelay(relayResult.egressEnvelope);

    assert.strictEqual(finalOutput.rawClaim, 'DAMAGED_IPHONE_15_PRO');
    assert.strictEqual(finalOutput.neuraCoreEnrichment.fraudScrutinyRequired, true);
    assert.strictEqual(finalOutput.neuraCoreEnrichment.auditTimestamp, '2026-10-22T12:00:00Z');
  });

  it('enforces multi-tenant boundary isolation and prevents cross-tenant leaks', () => {
    vault.registerEntity('other-tenant-beta', 'erp-1');
    const otherTenantErp = new CryptoMeshClient(vault.exportClientCredentials('other-tenant-beta', 'erp-1'));

    const envelope = otherTenantErp.encryptForRelay('communicator', { data: 'TENANT_B_ISOLATED' });

    assert.throws(() => {
      // Communicator from tenant-enterprise-omega attempts to decrypt
      communicatorClient.decryptFromRelay(envelope);
    }, CryptographicIntegrityError);
  });
});
