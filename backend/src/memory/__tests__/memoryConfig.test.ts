import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createMemoryGatewayFromEnvironment,
  loadMemoryGatewayConfig,
} from '../memoryConfig';

const keyBase64 = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');

describe('memory gateway configuration', () => {
  it('loads a private Hindsight endpoint and versioned bank key', () => {
    const config = loadMemoryGatewayConfig({
      HINDSIGHT_BASE_URL: 'http://127.0.0.1:8888/',
      HINDSIGHT_API_KEY: 'private-hindsight-key',
      HINDSIGHT_MEMORY_BANK_HMAC_KEY_BASE64: keyBase64,
      HINDSIGHT_MEMORY_BANK_KEY_VERSION: '3',
    });

    assert.equal(config.baseUrl, 'http://127.0.0.1:8888');
    assert.equal(config.apiKey, 'private-hindsight-key');
    assert.equal(config.bankKeyVersion, 3);
    assert.deepEqual(config.bankKey, Buffer.from('0123456789abcdef0123456789abcdef'));
  });

  it('fails closed for missing, public, or malformed bank configuration', () => {
    const invalidEnvironments = [
      {},
      {
        EXPO_PUBLIC_HINDSIGHT_BASE_URL: 'http://127.0.0.1:8888',
        EXPO_PUBLIC_HINDSIGHT_BANK: 'rosebud',
      },
      {
        HINDSIGHT_BASE_URL: 'file:///tmp/hindsight',
        HINDSIGHT_MEMORY_BANK_HMAC_KEY_BASE64: keyBase64,
        HINDSIGHT_MEMORY_BANK_KEY_VERSION: '1',
      },
      {
        HINDSIGHT_BASE_URL: 'http://127.0.0.1:8888',
        HINDSIGHT_MEMORY_BANK_HMAC_KEY_BASE64: Buffer.from('too-short').toString('base64'),
        HINDSIGHT_MEMORY_BANK_KEY_VERSION: '1',
      },
      {
        HINDSIGHT_BASE_URL: 'http://127.0.0.1:8888',
        HINDSIGHT_MEMORY_BANK_HMAC_KEY_BASE64: keyBase64,
        HINDSIGHT_MEMORY_BANK_KEY_VERSION: '0',
      },
    ];

    for (const environment of invalidEnvironments) {
      assert.throws(() => loadMemoryGatewayConfig(environment), /Hindsight|memory bank/i);
    }
  });

  it('soft-disables when wholly absent and rejects partial runtime configuration', () => {
    assert.equal(createMemoryGatewayFromEnvironment({}), undefined);
    assert.throws(() => createMemoryGatewayFromEnvironment({
      HINDSIGHT_BASE_URL: 'http://127.0.0.1:8888',
    }), /memory bank/i);
    assert.ok(createMemoryGatewayFromEnvironment({
      HINDSIGHT_BASE_URL: 'http://127.0.0.1:8888',
      HINDSIGHT_MEMORY_BANK_HMAC_KEY_BASE64: keyBase64,
      HINDSIGHT_MEMORY_BANK_KEY_VERSION: '1',
    }));
  });
});
