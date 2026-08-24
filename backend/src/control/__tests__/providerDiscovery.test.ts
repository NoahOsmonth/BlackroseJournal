import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { discoverProviderModels } from '../providerDiscovery';
import type { ProviderRecord } from '../controlPlaneTypes';

const baseProvider: ProviderRecord = {
  id: 'provider-1',
  name: 'Provider',
  protocol: 'openai-chat-completions',
  baseUrl: 'https://models.example/v1',
  state: 'active',
  revision: 1,
  displayMetadata: { label: 'Provider' },
  discoveryConfig: { modelsPath: '/models' },
  createdAt: '2026-08-24T00:00:00.000Z',
  updatedAt: '2026-08-24T00:00:00.000Z',
};

describe('provider model discovery', () => {
  it('normalizes OpenAI-compatible inventories and keeps secrets out of results', async () => {
    let requestUrl = '';
    let authorization = '';
    const models = await discoverProviderModels(baseProvider, 'sk-private', {
      request: async (url, options) => {
        requestUrl = url;
        authorization = options.headers?.authorization ?? '';
        return {
          status: 200,
          headers: {},
          body: Buffer.from(JSON.stringify({ data: [{
            id: 'alpha-32k',
            name: 'Alpha',
            context_window: 32_768,
            capabilities: { tools: true, vision: false },
            api_key: 'must-not-leak',
          }] })),
        };
      },
    });

    assert.equal(requestUrl, 'https://models.example/v1/models');
    assert.equal(authorization, 'Bearer sk-private');
    assert.deepEqual(models[0], {
      upstreamModelId: 'alpha-32k',
      label: 'Alpha',
      capabilities: {
        streaming: true,
        tools: true,
        vision: false,
        jsonObject: true,
        jsonSchema: false,
      },
      contextWindow: 32_768,
      rawSafeMetadata: {},
    });
    assert.doesNotMatch(JSON.stringify(models), /sk-private|must-not-leak/);
  });

  it('uses protocol-specific authentication for Anthropic and Gemini inventories', async () => {
    const seen: { protocol: string; headers: Readonly<Record<string, string>> }[] = [];
    const request = async (_url: string, options: { headers?: Readonly<Record<string, string>> }) => {
      seen.push({ protocol: seen.length === 0 ? 'anthropic' : 'gemini', headers: options.headers ?? {} });
      const body = seen.length === 1
        ? { data: [{ id: 'claude-a', display_name: 'Claude A' }] }
        : { models: [{
          name: 'models/gemini-a',
          displayName: 'Gemini A',
          inputTokenLimit: 1_000_000,
          supportedGenerationMethods: ['generateContent'],
        }] };
      return { status: 200, headers: {}, body: Buffer.from(JSON.stringify(body)) };
    };

    const anthropic = await discoverProviderModels({
      ...baseProvider,
      protocol: 'anthropic-messages',
    }, 'anthropic-secret', { request });
    const gemini = await discoverProviderModels({
      ...baseProvider,
      protocol: 'gemini-generate-content',
    }, 'gemini-secret', { request });

    assert.equal(seen[0].headers['x-api-key'], 'anthropic-secret');
    assert.equal(seen[0].headers['anthropic-version'], '2023-06-01');
    assert.equal(seen[1].headers['x-goog-api-key'], 'gemini-secret');
    assert.equal(anthropic[0].upstreamModelId, 'claude-a');
    assert.equal(gemini[0].upstreamModelId, 'gemini-a');
    assert.equal(gemini[0].contextWindow, 1_000_000);
  });

  it('fails closed on non-success or malformed upstream inventory responses', async () => {
    await assert.rejects(
      () => discoverProviderModels(baseProvider, 'secret', {
        request: async () => ({ status: 401, headers: {}, body: Buffer.from('denied') }),
      }),
      /discovery failed/i,
    );
    await assert.rejects(
      () => discoverProviderModels(baseProvider, 'secret', {
        request: async () => ({ status: 200, headers: {}, body: Buffer.from('{bad') }),
      }),
      /invalid/i,
    );
  });
});
