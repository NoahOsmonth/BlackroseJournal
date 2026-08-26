import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NormalizedInferenceEvent } from '../../../../packages/ai-control-plane-contracts/src';
import type { MasterKeyProvider } from '../../security/envelopeEncryption';
import { RetryExecutionError } from '../../control/sameRouteRetry';
import { createManagedInferenceService } from '../managedInferenceService';
import type { ManagedInferenceRouteBinding, UsageEventInput } from '../managedInferenceTypes';

const binding: ManagedInferenceRouteBinding = {
  routeId: 'route-fixed', purpose: 'chat', providerId: 'provider-1',
  protocol: 'openai-chat-completions', baseUrl: 'https://models.example/v1',
  modelId: 'upstream-fixed',
  capabilities: {
    streaming: true, tools: true, vision: true, jsonObject: true, jsonSchema: true,
  },
  credential: {
    version: 1, algorithm: 'A256GCM', keyVersion: 1,
    nonce: 'AAAAAAAAAAAAAAAA', ciphertext: 'encrypted',
    authenticationTag: 'AAAAAAAAAAAAAAAAAAAAAA',
  },
  maxInputBytes: 4_096,
  maxOutputTokens: 512,
  requestTimeoutMs: 2_000,
};

const masterKeys: MasterKeyProvider = {
  getCurrentKey: async () => ({ version: 1, key: Buffer.alloc(32, 1) }),
  getKey: async () => Buffer.alloc(32, 1),
};

const request = {
  purpose: 'chat' as const,
  messages: [{ role: 'user' as const, content: 'Hello' }],
  responseFormat: { type: 'json_object' as const },
  stream: true,
};

async function collect(source: AsyncIterable<NormalizedInferenceEvent>) {
  const events: NormalizedInferenceEvent[] = [];
  for await (const event of source) events.push(event);
  return events;
}

describe('managed inference service', () => {
  it('resolves once and retries only the same route/model before the first event', async () => {
    const attempts: { routeId: string; modelId: string; secret: string }[] = [];
    const usage: UsageEventInput[] = [];
    const service = createManagedInferenceService({
      repository: {
        resolveRoute: async () => binding,
        appendUsage: async (event) => { usage.push(event); },
      },
      masterKeys,
      decryptCredential: async () => 'provider-secret',
      execute: (input) => (async function* execute() {
        attempts.push({
          routeId: binding.routeId, modelId: input.modelId, secret: input.secret,
        });
        if (attempts.length === 1) throw new RetryExecutionError('temporary', 503);
        yield { type: 'text_delta', text: '{"ok":true}' };
        yield { type: 'usage', inputTokens: 4, outputTokens: 3, totalTokens: 7 };
        yield { type: 'completion', reason: 'stop' };
      })(),
    });

    const events = await collect(service.execute('user-1', request));

    assert.deepEqual(attempts.map(({ routeId, modelId }) => ({ routeId, modelId })), [
      { routeId: 'route-fixed', modelId: 'upstream-fixed' },
      { routeId: 'route-fixed', modelId: 'upstream-fixed' },
    ]);
    assert.equal(events.at(-1)?.type, 'completion');
    assert.equal(usage[0].status, 'succeeded');
    assert.equal(usage[0].inputTokens, 4);
    assert.doesNotMatch(JSON.stringify(events), /provider-secret|models\.example/);
  });

  it('enforces the resolved route ceilings before decrypting or calling upstream', async () => {
    let touchedSecret = false;
    const service = createManagedInferenceService({
      repository: { resolveRoute: async () => ({ ...binding, maxInputBytes: 10 }), appendUsage: async () => undefined },
      masterKeys,
      decryptCredential: async () => { touchedSecret = true; return 'secret'; },
      execute: () => { throw new Error('must not execute'); },
    });

    const events = await collect(service.execute('user-1', request));

    assert.equal(touchedSecret, false);
    assert.deepEqual(events.map((event) => event.type), ['error', 'completion']);
    assert.equal(events[0].type === 'error' && events[0].error.code, 'invalid_request');
  });

  it('rejects structured extraction when the fixed model lacks that capability', async () => {
    let touchedSecret = false;
    const service = createManagedInferenceService({
      repository: {
        resolveRoute: async () => ({
          ...binding,
          capabilities: { ...binding.capabilities, jsonObject: false },
        }),
        appendUsage: async () => undefined,
      },
      masterKeys,
      decryptCredential: async () => { touchedSecret = true; return 'secret'; },
      execute: () => { throw new Error('must not execute'); },
    });

    const events = await collect(service.execute('user-1', request));

    assert.equal(touchedSecret, false);
    assert.equal(events[0].type === 'error' && events[0].error.code, 'invalid_request');
  });

  it('uses the hidden flash binding and forwards structured extraction unchanged', async () => {
    let observedPurpose = '';
    let observedFormat = '';
    const service = createManagedInferenceService({
      repository: {
        resolveRoute: async (_userId, purpose) => {
          observedPurpose = purpose;
          return { ...binding, purpose: 'flash' };
        },
        appendUsage: async () => undefined,
      },
      masterKeys,
      decryptCredential: async () => 'secret',
      execute: (input) => (async function* execute() {
        observedFormat = input.request.responseFormat?.type ?? '';
        yield { type: 'completion', reason: 'stop' };
      })(),
    });

    await collect(service.execute('user-1', { ...request, purpose: 'flash', stream: false }));

    assert.equal(observedPurpose, 'flash');
    assert.equal(observedFormat, 'json_object');
  });

  it('does not silently choose another model when the user selection has no active route', async () => {
    let called = false;
    const service = createManagedInferenceService({
      repository: { resolveRoute: async () => null, appendUsage: async () => undefined },
      masterKeys,
      execute: () => {
        called = true;
        return (async function* execute() {})();
      },
    });

    const events = await collect(service.execute('user-1', request));

    assert.equal(called, false);
    assert.equal(events[0].type === 'error' && events[0].error.code, 'model_unavailable');
  });

  it('preserves normalized adapter rate-limit errors after bounded retries', async () => {
    let attempts = 0;
    const service = createManagedInferenceService({
      repository: { resolveRoute: async () => binding, appendUsage: async () => undefined },
      masterKeys,
      decryptCredential: async () => 'secret',
      execute: () => (async function* execute() {
        attempts += 1;
        throw Object.assign(new Error('generic'), {
          code: 'rate_limited', retryable: true, status: 429,
        });
      })(),
    });

    const events = await collect(service.execute('user-1', request));

    assert.equal(attempts, 2);
    assert.equal(events[0].type === 'error' && events[0].error.code, 'rate_limited');
    assert.doesNotMatch(JSON.stringify(events), /generic/);
  });
});
