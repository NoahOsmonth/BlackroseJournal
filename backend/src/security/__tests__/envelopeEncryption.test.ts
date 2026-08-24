import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  decryptSecret,
  encryptSecret,
  MasterKeyProvider,
} from '../envelopeEncryption';

function keyProvider(): MasterKeyProvider {
  const keys = new Map([[7, randomBytes(32)]]);
  return {
    getCurrentKey: async () => ({ version: 7, key: keys.get(7) as Buffer }),
    getKey: async (version) => keys.get(version) ?? null,
  };
}

describe('AES-256-GCM credential envelope', () => {
  it('round trips through an external versioned master-key provider without plaintext', async () => {
    const provider = keyProvider();
    const envelope = await encryptSecret('provider-secret-value', provider, 'provider:abc');

    assert.equal(envelope.version, 1);
    assert.equal(envelope.keyVersion, 7);
    assert.equal(envelope.algorithm, 'A256GCM');
    assert.doesNotMatch(JSON.stringify(envelope), /provider-secret-value/);
    assert.equal(
      await decryptSecret(envelope, provider, 'provider:abc'),
      'provider-secret-value',
    );
  });

  it('rejects ciphertext tampering and use under another provider context', async () => {
    const provider = keyProvider();
    const envelope = await encryptSecret('provider-secret-value', provider, 'provider:abc');
    const tampered = {
      ...envelope,
      ciphertext: `${envelope.ciphertext[0] === 'A' ? 'B' : 'A'}${envelope.ciphertext.slice(1)}`,
    };

    await assert.rejects(() => decryptSecret(tampered, provider, 'provider:abc'));
    await assert.rejects(() => decryptSecret(envelope, provider, 'provider:other'));
  });

  it('fails closed for unavailable key versions and malformed master keys', async () => {
    const provider = keyProvider();
    const envelope = await encryptSecret('provider-secret-value', provider, 'provider:abc');
    await assert.rejects(() => decryptSecret(envelope, {
      getCurrentKey: provider.getCurrentKey,
      getKey: async () => null,
    }, 'provider:abc'));
    await assert.rejects(() => encryptSecret('secret', {
      getCurrentKey: async () => ({ version: 1, key: randomBytes(16) }),
      getKey: async () => null,
    }, 'provider:abc'));
  });
});
