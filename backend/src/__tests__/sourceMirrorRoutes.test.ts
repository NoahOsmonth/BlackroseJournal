import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express, { type RequestHandler } from 'express';
import http from 'node:http';
import type { DeploymentWriteRequest } from '../../../shared/memory/deploymentAuthority';
import type {
  MirrorChunk,
  MirrorConversation,
} from '../../../shared/memory/mirrorContracts';
import { sha256CanonicalMirrorChunk } from '../memory/canonicalSourceHash';
import { registerSourceMirrorRoutes } from '../memory/routes/sourceMirrorRoutes';
import {
  SourceMirrorRepositoryError,
  type SourceMirrorRepository,
} from '../memory/repositories/sourceMirrorRepository';
import { validMirrorChunk } from './sourceHash.test';

const ownerId = '00000000-0000-4000-8000-00000000000a';
const sessionId = '00000000-0000-4000-8000-0000000000ee';
const datasetId = '00000000-0000-4000-8000-0000000000aa';
const permitId = '00000000-0000-4000-8000-0000000000bb';

const authority: DeploymentWriteRequest = {
  deploymentId: 'blackrose-primary',
  writerEpoch: 7,
  writerLeaseId: '00000000-0000-4000-8000-000000000077',
  writerLeaseToken: 'opaque-writer-lease-token',
  sourceCredentialFingerprint: 'sha256:source-a',
};

const manifest = {
  id: 'manifest-1',
  ownerId,
  contractVersion: 1,
  datasetId,
  importGeneration: 5,
  declaredChunkCount: 1,
  sourceCount: 1,
  messageCount: 1,
  sourceHash: 'sha256:abc',
  status: 'receiving' as const,
  completionReceipt: null,
  cancellationReceipt: null,
  latestErrorCode: null,
  completedAt: null,
  createdAt: '2026-08-01T10:00:00.000Z',
};

const ownerState = {
  ownerId,
  authorityState: 'MIRROR' as const,
  authorityVersion: 3,
  datasetId,
  featureFlags: {
    cloudSourceMirroring: true,
    cloudProjectionBuild: false,
    shadowRetrieval: false,
    cloudReadAuthority: false,
    cloudWriteAuthority: false,
  },
  sourceSetVersion: 2,
  sourceSetReceipt: 'mirror-union:manifest-1:2:sha256:abc',
};

const chunkReceipt = {
  chunkIndex: 0,
  itemCount: 1,
  conversationCount: 1,
  messageCount: 1,
  chunkHash: 'sha256:abc',
  payloadHash: 'sha256:abc',
  receipt: 'mirror-chunk:manifest-1:0:sha256:abc',
  status: 'accepted' as const,
};

const permit = {
  id: permitId,
  ownerId,
  manifestId: 'manifest-1',
  importGeneration: 5,
  expectedAuthorityVersion: 3,
  expiresAt: '2026-08-01T10:00:08.000Z',
  consumedAt: null,
};

const deletion = {
  id: '00000000-0000-4000-8000-0000000000cc',
  ownerId,
  sourceKind: 'journal',
  sourceId: 'entry-1',
  sourceRevision: 2,
  clientEventId: 'journal%3Aentry-1:msg-1',
  deletedAt: '2026-08-01T10:00:00.000Z',
  reasonCode: 'user_deleted',
  verificationStatus: 'pending',
};

const parity = {
  authorityState: 'MIRROR' as const,
  authorityVersion: 3,
  sourceSetVersion: 2,
  sourceSetReceipt: 'mirror-union:manifest-1:2:sha256:abc',
  conversationCount: 1,
  messageCount: 1,
  sourceSetHash: 'sha256:abc',
};

function makeConversation(recordId: string): MirrorConversation {
  const id = `journal:${recordId}`;
  const clientEventId = `${encodeURIComponent(id)}:msg-1`;
  return {
    id,
    sourceKind: 'journal',
    sourceRecordId: recordId,
    status: 'settled',
    startedAt: '2026-08-01T10:00:00.000Z',
    settledAt: null,
    timezone: null,
    weekStartsOn: null,
    temporalProvenance: 'legacy_unknown',
    clientSchemaVersion: 1,
    sourceRevision: 1,
    previousAcceptedRevision: null,
    messages: [
      {
        id: clientEventId,
        conversationId: id,
        clientEventId,
        role: 'user',
        sequence: 0,
        authoredAt: '2026-08-01T10:00:00.000Z',
        authoredTimezone: null,
        localDate: null,
        temporalProvenance: 'legacy_unknown',
        content: 'hello',
        revision: 1,
        previousAcceptedRevision: null,
        status: 'active',
      },
    ],
  };
}

function chunkWithConversations(conversations: MirrorConversation[]): MirrorChunk {
  return {
    contractVersion: 1,
    manifestId: 'manifest-1',
    chunkIndex: 0,
    conversations,
  };
}

function makeRepository(overrides: Partial<SourceMirrorRepository> = {}): {
  repository: SourceMirrorRepository;
  calls: Array<{ method: string; args: unknown[] }>;
} {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const record = (method: string) => (
    <T extends (...args: never[]) => unknown>(impl: T): T => {
      const wrapped = ((...args: never[]) => {
        calls.push({ method, args });
        return impl(...args);
      }) as T;
      return wrapped;
    }
  );
  const repository: SourceMirrorRepository = {
    enroll: record('enroll')(async () => ownerState),
    beginImport: record('beginImport')(async () => manifest),
    getImport: record('getImport')(async () => manifest),
    acceptChunk: record('acceptChunk')(async () => chunkReceipt),
    cancelImport: record('cancelImport')(async () => manifest),
    validateImport: record('validateImport')(async () => manifest),
    prepareCompletion: record('prepareCompletion')(async () => permit),
    completeImport: record('completeImport')(async () => manifest),
    applyTombstone: record('applyTombstone')(async () => deletion),
    getParity: record('getParity')(async () => parity),
    ...overrides,
  };
  return { repository, calls };
}

async function withServer(
  deps: {
    repository: SourceMirrorRepository;
    authority: DeploymentWriteRequest | null;
    writesEnabled: boolean;
    authMiddleware?: RequestHandler;
  },
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  const authMiddleware: RequestHandler = deps.authMiddleware ?? ((_req, res, next) => {
    res.locals.memoryAuth = {
      ownerId,
      accessToken: 'user-token',
      sessionId,
      isAnonymous: false,
    };
    next();
  });
  registerSourceMirrorRoutes(app, {
    authMiddleware,
    repository: deps.repository,
    authority: deps.authority,
    writesEnabled: deps.writesEnabled,
  });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => {
      if (error) reject(error); else resolve();
    }));
  }
}

describe('source mirror routes', () => {
  it('applies no-store and serves GET state without reserving a mutation', async () => {
    const { repository, calls } = makeRepository();
    await withServer({
      repository,
      authority,
      writesEnabled: true,
    }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/memory/mirror/parity`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await response.json(), { data: parity });
    });
    assert.deepEqual(calls.map((call) => call.method), ['getParity']);
  });

  it('rejects body and query owner fields and never forwards them', async () => {
    for (const [method, path, body] of [
      ['POST', '/v1/memory/mirror/enroll', { ownerId: '00000000-0000-4000-8000-0000000000ff', datasetId }],
      ['POST', '/v1/memory/mirror/enroll?owner_id=00000000-0000-4000-8000-0000000000ff', {}],
      ['POST', '/v1/memory/mirror/imports', { manifestId: 'manifest-1', datasetId, ownerId: '00000000-0000-4000-8000-0000000000ff' }],
    ] as const) {
      const { repository, calls } = makeRepository();
      await withServer({
        repository,
        authority,
        writesEnabled: true,
      }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}${path}`, {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        assert.equal(response.status, 400);
        const payload = await response.json() as { error: { code: string } };
        assert.equal(payload.error.code, 'MIRROR_BAD_REQUEST');
      });
      assert.equal(calls.length, 0, `unexpected repository call for ${path}`);
    }
  });

  it('always takes the owner and session from the verified JWT, never the body', async () => {
    const { repository, calls } = makeRepository();
    await withServer({
      repository,
      authority,
      writesEnabled: true,
    }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/memory/mirror/enroll`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ datasetId }),
      });
      assert.equal(response.status, 200);
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'enroll');
    assert.deepEqual(calls[0].args, [authority, ownerId, sessionId, datasetId]);
  });

  it('rejects mirror requests without a verified session', async () => {
    const { repository, calls } = makeRepository();
    const noSessionAuth: RequestHandler = (_req, res, next) => {
      res.locals.memoryAuth = { ownerId, accessToken: 'token' };
      next();
    };
    await withServer({
      repository,
      authority,
      writesEnabled: true,
      authMiddleware: noSessionAuth,
    }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/memory/mirror/parity`);
      assert.equal(response.status, 401);
      const payload = await response.json() as { error: { code: string } };
      assert.equal(payload.error.code, 'MIRROR_UNAUTHORIZED');
    });
    assert.equal(calls.length, 0);
  });

  it('disables only mutation routes under the kill switch; GET stays healthy', async () => {
    const { repository, calls } = makeRepository();
    await withServer({
      repository,
      authority,
      writesEnabled: false,
    }, async (baseUrl) => {
      const mutation = await fetch(`${baseUrl}/v1/memory/mirror/imports`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          manifestId: 'manifest-1',
          datasetId,
          contractVersion: 1,
          importGeneration: 5,
          declaredChunkCount: 1,
          sourceCount: 1,
          messageCount: 1,
          sourceHash: 'sha256:abc',
        }),
      });
      assert.equal(mutation.status, 503);
      const mutationBody = await mutation.json() as { error: { code: string } };
      assert.equal(mutationBody.error.code, 'MIRROR_WRITES_DISABLED');

      const read = await fetch(`${baseUrl}/v1/memory/mirror/parity`);
      assert.equal(read.status, 200);
      assert.deepEqual(await read.json(), { data: parity });
    });
    assert.deepEqual(calls.map((call) => call.method), ['getParity']);
  });

  it('recomputes the chunk hash in Node and never trusts the client hash', async () => {
    const { repository, calls } = makeRepository();
    await withServer({
      repository,
      authority,
      writesEnabled: true,
    }, async (baseUrl) => {
      const chunk = validMirrorChunk();
      const response = await fetch(
        `${baseUrl}/v1/memory/mirror/imports/manifest-1/chunks/0`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chunk, clientHash: 'sha256:client-lied' }),
        },
      );
      assert.equal(response.status, 200);
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'acceptChunk');
    const args = calls[0].args as [unknown, string, string, string, number, MirrorChunk, string];
    assert.equal(args[0], authority);
    assert.equal(args[1], ownerId);
    assert.equal(args[2], sessionId);
    assert.equal(args[3], 'manifest-1');
    assert.equal(args[4], 0);
    assert.equal(
      args[6],
      sha256CanonicalMirrorChunk(validMirrorChunk()),
    );
    assert.notEqual(args[6], 'sha256:client-lied');
  });

  it('returns typed 429 with database-derived Retry-After', async () => {
    const repository: SourceMirrorRepository = makeRepository({
      acceptChunk: async () => {
        throw new SourceMirrorRepositoryError('MIRROR_RATE_LIMITED', 429, 37);
      },
    }).repository;
    await withServer({
      repository,
      authority,
      writesEnabled: true,
    }, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/v1/memory/mirror/imports/manifest-1/chunks/0`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chunk: validMirrorChunk() }),
        },
      );
      assert.equal(response.status, 429);
      assert.equal(response.headers.get('retry-after'), '37');
      const payload = await response.json() as { error: { code: string } };
      assert.equal(payload.error.code, 'MIRROR_RATE_LIMITED');
    });
  });

  it('maps validation failures to stable codes without touching the repository', async () => {
    const cases: Array<{
      method: string;
      path: string;
      body: unknown;
      expectedStatus: number;
    }> = [
      {
        method: 'POST',
        path: '/v1/memory/mirror/imports',
        body: { manifestId: '', datasetId },
        expectedStatus: 400,
      },
      {
        method: 'POST',
        path: '/v1/memory/mirror/imports',
        body: { manifestId: 'manifest-1', datasetId: 'not-a-uuid' },
        expectedStatus: 400,
      },
      {
        method: 'PUT',
        path: '/v1/memory/mirror/imports/manifest-1/chunks/not-a-number',
        body: { chunk: validMirrorChunk() },
        expectedStatus: 400,
      },
      {
        method: 'PUT',
        path: '/v1/memory/mirror/imports/manifest-1/chunks/-1',
        body: { chunk: validMirrorChunk() },
        expectedStatus: 400,
      },
      {
        method: 'PUT',
        path: '/v1/memory/mirror/imports/manifest-1/chunks/0',
        body: { chunk: { not: 'a chunk' } },
        expectedStatus: 400,
      },
      {
        method: 'POST',
        path: '/v1/memory/mirror/imports/manifest-1/prepare-completion',
        body: { expectedAuthorityVersion: 0 },
        expectedStatus: 400,
      },
      {
        method: 'POST',
        path: '/v1/memory/mirror/tombstones',
        body: { sourceKind: 'journal', sourceRevision: 0 },
        expectedStatus: 400,
      },
    ];
    for (const testCase of cases) {
      const { repository, calls } = makeRepository();
      await withServer({
        repository,
        authority,
        writesEnabled: true,
      }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}${testCase.path}`, {
          method: testCase.method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(testCase.body),
        });
        assert.equal(response.status, testCase.expectedStatus, testCase.path);
        const payload = await response.json() as { error: { code: string } };
        assert.equal(payload.error.code, 'MIRROR_BAD_REQUEST', testCase.path);
      });
      assert.equal(calls.length, 0, `unexpected call for ${testCase.path}`);
    }
  });

  it('returns 413 for an over-byte-bound chunk and 400 for an over-item-bound chunk', async () => {
    const { repository, calls } = makeRepository();
    await withServer({
      repository,
      authority,
      writesEnabled: true,
    }, async (baseUrl) => {
      const oversized = chunkWithConversations([
        makeConversation('entry-1'),
      ]);
      oversized.conversations[0].messages[0] = {
        ...oversized.conversations[0].messages[0],
        content: 'x'.repeat(270_000),
      };
      const tooBig = await fetch(
        `${baseUrl}/v1/memory/mirror/imports/manifest-1/chunks/0`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chunk: oversized }),
        },
      );
      assert.equal(tooBig.status, 413);
      const tooBigBody = await tooBig.json() as { error: { code: string } };
      assert.equal(tooBigBody.error.code, 'MIRROR_PAYLOAD_TOO_LARGE');

      const tooMany = chunkWithConversations(
        Array.from({ length: 17 }, (_, index) => makeConversation(`entry-${index + 1}`)),
      );
      const overItems = await fetch(
        `${baseUrl}/v1/memory/mirror/imports/manifest-1/chunks/0`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chunk: tooMany }),
        },
      );
      assert.equal(overItems.status, 400);
      const overItemsBody = await overItems.json() as { error: { code: string } };
      assert.equal(overItemsBody.error.code, 'MIRROR_BAD_REQUEST');
    });
    assert.equal(calls.length, 0);
  });

  it('returns an identical receipt for an identical route retry', async () => {
    const { repository } = makeRepository();
    await withServer({
      repository,
      authority,
      writesEnabled: true,
    }, async (baseUrl) => {
      const body = {
        manifestId: 'manifest-1',
        datasetId,
        contractVersion: 1,
        importGeneration: 5,
        declaredChunkCount: 1,
        sourceCount: 1,
        messageCount: 1,
        sourceHash: 'sha256:abc',
      };
      const first = await fetch(`${baseUrl}/v1/memory/mirror/imports`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const second = await fetch(`${baseUrl}/v1/memory/mirror/imports`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.deepEqual(await first.json(), await second.json());
    });
  });

  it('maps stable repository errors to HTTP statuses and codes', async () => {
    const cases: Array<{
      code: SourceMirrorRepositoryError['code'];
      status: number;
      repository: SourceMirrorRepository;
    }> = [
      {
        code: 'MIRROR_UNAUTHORIZED',
        status: 401,
        repository: makeRepository({
          beginImport: async () => { throw new SourceMirrorRepositoryError('MIRROR_UNAUTHORIZED', 401, null); },
        }).repository,
      },
      {
        code: 'MIRROR_FORBIDDEN',
        status: 403,
        repository: makeRepository({
          beginImport: async () => { throw new SourceMirrorRepositoryError('MIRROR_FORBIDDEN', 403, null); },
        }).repository,
      },
      {
        code: 'MIRROR_NOT_FOUND',
        status: 404,
        repository: makeRepository({
          beginImport: async () => { throw new SourceMirrorRepositoryError('MIRROR_NOT_FOUND', 404, null); },
        }).repository,
      },
      {
        code: 'MIRROR_CONFLICT',
        status: 409,
        repository: makeRepository({
          beginImport: async () => { throw new SourceMirrorRepositoryError('MIRROR_CONFLICT', 409, null); },
        }).repository,
      },
      {
        code: 'MIRROR_HASH_MISMATCH',
        status: 422,
        repository: makeRepository({
          beginImport: async () => { throw new SourceMirrorRepositoryError('MIRROR_HASH_MISMATCH', 422, null); },
        }).repository,
      },
      {
        code: 'WRITER_STALE_EPOCH',
        status: 503,
        repository: makeRepository({
          beginImport: async () => { throw new SourceMirrorRepositoryError('WRITER_STALE_EPOCH', 503, null); },
        }).repository,
      },
      {
        code: 'WRITER_LEASE_MISMATCH',
        status: 503,
        repository: makeRepository({
          beginImport: async () => { throw new SourceMirrorRepositoryError('WRITER_LEASE_MISMATCH', 503, null); },
        }).repository,
      },
      {
        code: 'WRITER_LEASE_EXPIRED',
        status: 503,
        repository: makeRepository({
          beginImport: async () => { throw new SourceMirrorRepositoryError('WRITER_LEASE_EXPIRED', 503, null); },
        }).repository,
      },
      {
        code: 'WRITER_TOKEN_REJECTED',
        status: 503,
        repository: makeRepository({
          beginImport: async () => { throw new SourceMirrorRepositoryError('WRITER_TOKEN_REJECTED', 503, null); },
        }).repository,
      },
      {
        code: 'WRITER_CREDENTIAL_MISMATCH',
        status: 503,
        repository: makeRepository({
          beginImport: async () => { throw new SourceMirrorRepositoryError('WRITER_CREDENTIAL_MISMATCH', 503, null); },
        }).repository,
      },
      {
        code: 'WRITER_MODE_NOT_ACTIVE',
        status: 503,
        repository: makeRepository({
          beginImport: async () => { throw new SourceMirrorRepositoryError('WRITER_MODE_NOT_ACTIVE', 503, null); },
        }).repository,
      },
      {
        code: 'MIRROR_UNAVAILABLE',
        status: 503,
        repository: makeRepository({
          beginImport: async () => { throw new SourceMirrorRepositoryError('MIRROR_UNAVAILABLE', 503, null); },
        }).repository,
      },
    ];
    for (const testCase of cases) {
      await withServer({
        repository: testCase.repository,
        authority,
        writesEnabled: true,
      }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/v1/memory/mirror/imports`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            manifestId: 'manifest-1',
            datasetId,
            contractVersion: 1,
            importGeneration: 5,
            declaredChunkCount: 1,
            sourceCount: 1,
            messageCount: 1,
            sourceHash: 'sha256:abc',
          }),
        });
        assert.equal(response.status, testCase.status, testCase.code);
        const payload = await response.json() as { error: { code: string } };
        assert.equal(payload.error.code, testCase.code);
      });
    }
  });

  it('never leaks request payloads or upstream bodies into error responses', async () => {
    const secret = 'SUPER-SECRET-PHRASE-42';
    const repository: SourceMirrorRepository = makeRepository({
      acceptChunk: async () => {
        throw new SourceMirrorRepositoryError('MIRROR_CONFLICT', 409, null);
      },
    }).repository;
    await withServer({
      repository,
      authority,
      writesEnabled: true,
    }, async (baseUrl) => {
      const chunk = validMirrorChunk();
      chunk.conversations[0].messages[0] = {
        ...chunk.conversations[0].messages[0],
        content: secret,
      };
      const response = await fetch(
        `${baseUrl}/v1/memory/mirror/imports/manifest-1/chunks/0`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chunk }),
        },
      );
      assert.equal(response.status, 409);
      const serialized = JSON.stringify(await response.json());
      assert.doesNotMatch(serialized, new RegExp(secret));
      assert.doesNotMatch(serialized, /upstream|database/i);
    });
  });
});
