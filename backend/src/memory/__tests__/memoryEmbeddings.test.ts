import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { OmnirouteInferenceExecutor } from '../../inference/omnirouteInferenceExecutor';
import {
  createSoftFailMemoryEmbedder,
  createOmnirouteMemoryEmbedderFromEnvironment,
} from '../memoryEmbeddings';

function makeExecutor(overrides: Partial<OmnirouteInferenceExecutor> = {}): OmnirouteInferenceExecutor {
  return {
    chat: async () => new Response('{}'),
    embed: async () => {
      throw new Error('should not be called');
    },
    ...overrides,
  };
}

describe('soft-fail memory embedder', () => {
  it('returns vectors in input order when OmniRoute succeeds', async () => {
    const seen: string[][] = [];
    const embedder = createSoftFailMemoryEmbedder({
      executor: makeExecutor({
        embed: async (req) => {
          seen.push(req.input);
          return req.input.map((_, index) => [index, index + 1]);
        },
      }),
    });
    const vectors = await embedder.embed('user-a', ['c', 'a', 'b']);
    assert.deepEqual(vectors, [[0, 1], [1, 2], [2, 3]]);
    assert.deepEqual(seen, [['c', 'a', 'b']]);
  });

  it('returns empty arrays instead of throwing when embeddings fail (500)', async () => {
    const warnings: Array<{ event: string; details: unknown }> = [];
    const embedder = createSoftFailMemoryEmbedder({
      executor: makeExecutor({
        embed: async () => {
          throw new Error('upstream 500');
        },
      }),
      logger: { warn: (event, details) => warnings.push({ event, details }) },
    });
    const vectors = await embedder.embed('user-a', ['x', 'y']);
    assert.deepEqual(vectors, [[], []]);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0]?.event, 'memory_embedding_failed');
    assert.equal(JSON.stringify(warnings[0]).includes('user-a'), false);
  });

  it('treats an unconfigured embedding model as a soft skip', async () => {
    let calls = 0;
    const embedder = createSoftFailMemoryEmbedder({
      executor: makeExecutor({
        embed: async () => {
          calls += 1;
          throw new Error('OmniRoute embedding model is not configured.');
        },
      }),
      logger: { warn: () => undefined },
    });
    assert.deepEqual(await embedder.embed('user-a', ['x']), [[]]);
    assert.equal(calls, 1);
  });
});

describe('memory embedder environment wiring', () => {
  it('is undefined when OMNIROUTE_EMBEDDING_MODEL is unset or empty', () => {
    assert.equal(createOmnirouteMemoryEmbedderFromEnvironment({}), undefined);
    assert.equal(createOmnirouteMemoryEmbedderFromEnvironment({
      OMNIROUTE_MANAGE_KEY: 'k',
      OMNIROUTE_EMBEDDING_MODEL: '   ',
    }), undefined);
  });

  it('builds an embedder that posts through the inference executor with the manage key', async () => {
    const calls: Array<{ url: string; auth?: string; body?: string }> = [];
    const embedder = createOmnirouteMemoryEmbedderFromEnvironment(
      { OMNIROUTE_MANAGE_KEY: 'manage-key', OMNIROUTE_EMBEDDING_MODEL: 'gemini-embedding-001' },
      {
        baseUrl: 'http://omni.test/',
        fetcher: async (url, init) => {
          calls.push({
            url: String(url),
            auth: (init?.headers as Record<string, string>)?.Authorization,
            body: typeof init?.body === 'string' ? init.body : undefined,
          });
          return new Response(JSON.stringify({
            data: [{ embedding: [7] }, { embedding: [8] }],
          }), { status: 200, headers: { 'content-type': 'application/json' } });
        },
      },
    );
    assert.ok(embedder);
    assert.deepEqual(await embedder.embed('user-a', ['p', 'q']), [[7], [8]]);
    assert.equal(calls[0]?.url, 'http://omni.test/v1/embeddings');
    assert.equal(calls[0]?.auth, 'Bearer manage-key');
    assert.deepEqual(JSON.parse(calls[0]?.body ?? '{}'), {
      model: 'gemini-embedding-001',
      input: ['p', 'q'],
    });
  });

  it('still soft-fails end to end when OmniRoute is unreachable', async () => {
    const embedder = createOmnirouteMemoryEmbedderFromEnvironment(
      { OMNIROUTE_MANAGE_KEY: 'manage-key', OMNIROUTE_EMBEDDING_MODEL: 'gemini-embedding-001' },
      { baseUrl: 'http://omni.test/', fetcher: async () => { throw new Error('unreachable'); } },
    );
    assert.ok(embedder);
    assert.deepEqual(await embedder.embed('user-a', ['only']), [[]]);
  });
});
