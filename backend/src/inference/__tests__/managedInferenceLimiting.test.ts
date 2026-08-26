import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NormalizedInferenceEvent } from '../../../../packages/ai-control-plane-contracts/src';
import type { MasterKeyProvider } from '../../security/envelopeEncryption';
import { ManagedInferenceLimitError, type ManagedInferenceLimiter } from '../managedInferenceLimiter';
import { createManagedInferenceService } from '../managedInferenceService';
import type { ManagedInferenceRouteBinding } from '../managedInferenceTypes';

const binding: ManagedInferenceRouteBinding = {
  routeId: 'route-1', purpose: 'chat', providerId: 'provider-1',
  protocol: 'openai-chat-completions', baseUrl: 'https://models.example/v1',
  modelId: 'model-1', capabilities: {
    streaming: true, tools: true, vision: true, jsonObject: true, jsonSchema: true,
  },
  credential: {
    version: 1, algorithm: 'A256GCM', keyVersion: 1,
    nonce: 'AAAAAAAAAAAAAAAA', ciphertext: 'encrypted',
    authenticationTag: 'AAAAAAAAAAAAAAAAAAAAAA',
  },
  maxInputBytes: 4096, maxOutputTokens: 256, requestTimeoutMs: 2000,
};
const masterKeys: MasterKeyProvider = {
  getCurrentKey: async () => ({ version: 1, key: Buffer.alloc(32, 1) }),
  getKey: async () => Buffer.alloc(32, 1),
};
const request = {
  purpose: 'chat' as const,
  messages: [{ role: 'user' as const, content: 'Hello' }],
  stream: true,
};
const collect = async (source: AsyncIterable<NormalizedInferenceEvent>) => {
  const events: NormalizedInferenceEvent[] = [];
  for await (const event of source) events.push(event);
  return events;
};

describe('managed inference limiter boundary', () => {
  it('rejects before route resolution, decryption, or upstream execution', async () => {
    let resolved = 0;
    let decrypted = 0;
    let executed = 0;
    const limiter: ManagedInferenceLimiter = {
      acquireUser: async () => { throw new ManagedInferenceLimitError(7); },
      acquireRoute: async () => { throw new Error('must not acquire route'); },
    };
    const service = createManagedInferenceService({
      limiter,
      repository: {
        resolveRoute: async () => { resolved += 1; return binding; },
        appendUsage: async () => undefined,
      },
      masterKeys,
      decryptCredential: async () => { decrypted += 1; return 'secret'; },
      execute: () => { executed += 1; return (async function* empty() {})(); },
    });

    await assert.rejects(() => collect(service.execute('user-1', request)), ManagedInferenceLimitError);
    assert.deepEqual({ resolved, decrypted, executed }, { resolved: 0, decrypted: 0, executed: 0 });
  });

  it('rejects a saturated fixed route after resolution but before decryption or upstream', async () => {
    let releasedUsers = 0;
    let decrypted = 0;
    let executed = 0;
    const limiter: ManagedInferenceLimiter = {
      acquireUser: async () => ({ release: () => { releasedUsers += 1; } }),
      acquireRoute: async () => { throw new ManagedInferenceLimitError(5); },
    };
    const service = createManagedInferenceService({
      limiter,
      repository: { resolveRoute: async () => binding, appendUsage: async () => undefined },
      masterKeys,
      decryptCredential: async () => { decrypted += 1; return 'secret'; },
      execute: () => { executed += 1; return (async function* empty() {})(); },
    });

    await assert.rejects(() => collect(service.execute('user-1', request)), ManagedInferenceLimitError);
    assert.deepEqual({ releasedUsers, decrypted, executed }, { releasedUsers: 1, decrypted: 0, executed: 0 });
  });

  it('releases concurrency after upstream errors and caller aborts', async () => {
    let acquired = 0;
    let released = 0;
    const limiter: ManagedInferenceLimiter = {
      acquireUser: async () => {
        acquired += 1;
        return { release: async () => { released += 1; } };
      },
      acquireRoute: async () => {
        acquired += 1;
        return { release: async () => { released += 1; } };
      },
    };
    let mode: 'error' | 'abort' = 'error';
    const service = createManagedInferenceService({
      limiter,
      repository: { resolveRoute: async () => binding, appendUsage: async () => undefined },
      masterKeys,
      decryptCredential: async () => 'secret',
      execute: (input) => (async function* upstream() {
        if (mode === 'error') throw new Error('upstream failed');
        yield { type: 'text_delta', text: 'started' } as const;
        await new Promise<void>((resolve) => {
          if (input.signal?.aborted) resolve();
          else input.signal?.addEventListener('abort', () => resolve(), { once: true });
        });
        throw new DOMException('Aborted', 'AbortError');
      })(),
    });

    await collect(service.execute('user-1', request));
    assert.equal(released, 2);
    mode = 'abort';
    const controller = new AbortController();
    const iterator = service.execute('user-1', request, controller.signal)[Symbol.asyncIterator]();
    assert.deepEqual(await iterator.next(), { done: false, value: { type: 'text_delta', text: 'started' } });
    controller.abort();
    while (!(await iterator.next()).done) { /* drain */ }
    assert.deepEqual({ acquired, released }, { acquired: 4, released: 4 });
  });
});
