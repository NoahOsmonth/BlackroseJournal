import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createHindsightMemoryGateway } from '../hindsightMemoryGateway';

const config = {
  baseUrl: 'http://hindsight.internal:8888',
  bankKey: Buffer.from('0123456789abcdef0123456789abcdef'),
  bankKeyVersion: 1,
  requestTimeoutMs: 1_000,
  maxResponseBytes: 64 * 1024,
};

describe('memory public contract translation', () => {
  it('translates public retain input to private Hindsight wire and returns a safe response', async () => {
    const seen: { url: string; body: unknown }[] = [];
    const gateway = createHindsightMemoryGateway(config, {
      fetcher: async (input, init) => {
        seen.push({ url: String(input), body: JSON.parse(String(init?.body)) as unknown });
        return new Response(JSON.stringify({ bank_id: 'must-not-escape', ok: true }));
      },
    });
    const result = await gateway.retain('user-alpha', {
      documentId: 'journal_entry:a', content: 'private journal',
      createdAt: '2026-08-24T00:00:00.000Z',
      metadata: { source: 'journal', sourceId: 'a', completed: true },
    });
    assert.deepEqual(result, { retained: true });
    assert.deepEqual(seen[0].body, { items: [{
      document_id: 'journal_entry:a', content: 'private journal',
      timestamp: '2026-08-24T00:00:00.000Z',
    }] });
    assert.equal(JSON.stringify(result).includes('bank'), false);
  });

  it('normalizes raw Hindsight recall and reflect responses to public DTOs', async () => {
    const gateway = createHindsightMemoryGateway(config, {
      fetcher: async (input) => String(input).endsWith('/reflect')
        ? new Response(JSON.stringify({ text: 'A pattern.' }))
        : new Response(JSON.stringify({ units: [{
            content: 'A memory', scores: { final: 0.82 }, document_id: 'journal_entry:a',
            occurred_start: '2026-08-24T00:00:00.000Z', bank_id: 'secret',
          }] })),
    });
    assert.deepEqual(await gateway.recall('user-alpha', { query: 'memory', limit: 2 }), {
      results: [{ documentId: 'journal_entry:a', content: 'A memory', score: 0.82,
        metadata: { source: 'journal', sourceId: 'a', completed: true,
          writtenAt: '2026-08-24T00:00:00.000Z' } }],
    });
    assert.deepEqual(await gateway.reflect('user-alpha', { query: 'pattern' }), {
      reflection: 'A pattern.',
    });
  });

  it('translates public rebuild records and reports the accepted count', async () => {
    const bodies: unknown[] = [];
    const gateway = createHindsightMemoryGateway(config, {
      fetcher: async (_input, init) => {
        if (init?.body) bodies.push(JSON.parse(String(init.body)) as unknown);
        return new Response(JSON.stringify({ ok: true }));
      },
    });
    const result = await gateway.rebuild('user-alpha', { items: [{
      documentId: 'intention_checkin:c', kind: 'check_in', content: 'A check-in',
      createdAt: '2026-08-24T01:00:00.000Z',
      metadata: { source: 'check_in', sourceId: 'c', completed: true },
    }] });
    assert.deepEqual(result, { accepted: 1 });
    assert.deepEqual(bodies, [{ items: [{ document_id: 'intention_checkin:c',
      content: 'A check-in', timestamp: '2026-08-24T01:00:00.000Z' }] }]);
  });

  it('returns a contract-safe clear response', async () => {
    const gateway = createHindsightMemoryGateway(config, {
      fetcher: async () => new Response(JSON.stringify({ bank: 'secret', ok: true })),
    });
    assert.deepEqual(await gateway.clear('user-alpha'), { cleared: true });
  });
});
