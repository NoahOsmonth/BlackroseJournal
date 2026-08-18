import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import type { RequestHandler } from 'express';
import type { DeploymentWriteRequest } from '../../../shared/memory/deploymentAuthority';
import { createApp } from '../app';
import {
  createMemoryAuthMiddleware,
  decodeAccessTokenPayload,
} from '../auth/supabaseAuth';
import type { MemoryRepository } from '../memory/repositories/memoryRepository';
import {
  SourceMirrorRepositoryError,
  type SourceMirrorRepository,
} from '../memory/repositories/sourceMirrorRepository';
import { validMirrorChunk } from './sourceHash.test';

const ownerId = '00000000-0000-4000-8000-00000000000a';
const otherOwnerId = '00000000-0000-4000-8000-00000000000b';
const sessionId = '00000000-0000-4000-8000-0000000000ee';
const datasetId = '00000000-0000-4000-8000-0000000000aa';

const authority: DeploymentWriteRequest = {
  deploymentId: 'blackrose-primary',
  writerEpoch: 7,
  writerLeaseId: '00000000-0000-4000-8000-000000000077',
  writerLeaseToken: 'opaque-writer-lease-token',
  sourceCredentialFingerprint: 'sha256:source-a',
};

function base64url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function accessToken(payload: Record<string, unknown>): string {
  return [
    base64url(JSON.stringify({ alg: 'none', typ: 'JWT' })),
    base64url(JSON.stringify(payload)),
    'unused-signature',
  ].join('.');
}

const verifiedToken = accessToken({
  sub: ownerId,
  session_id: sessionId,
  is_anonymous: false,
  role: 'authenticated',
});

const anonymousToken = accessToken({
  sub: ownerId,
  session_id: sessionId,
  is_anonymous: true,
  role: 'authenticated',
});

const wrongSubToken = accessToken({
  sub: otherOwnerId,
  session_id: sessionId,
  is_anonymous: false,
  role: 'authenticated',
});

const noSessionToken = accessToken({
  sub: ownerId,
  is_anonymous: false,
  role: 'authenticated',
});

const memoryAuthConfig = {
  supabaseUrl: 'https://project.supabase.co',
  supabasePublishableKey: 'publishable-test-key',
  timeoutMs: 100,
};

function createMirrorApp(
  repository: SourceMirrorRepository,
  options: { writesEnabled?: boolean } = {},
): express.Application {
  const baseAuth = createMemoryAuthMiddleware({
    config: memoryAuthConfig,
    verify: async (token) => (
      token === verifiedToken
        ? {
            status: 'verified',
            user: {
              ownerId,
              accessToken: token,
              sessionId: null,
              isAnonymous: false,
            },
          }
        : { status: 'invalid' }
    ),
  });
  const mirrorAuth = createMemoryAuthMiddleware({
    config: memoryAuthConfig,
    requireMirrorSession: true,
    verify: async (token) => (
      token === verifiedToken
        ? {
            status: 'verified',
            user: {
              ownerId,
              accessToken: token,
              sessionId: null,
              isAnonymous: false,
            },
          }
        : { status: 'invalid' }
    ),
  });
  const memoryRepository: MemoryRepository = {
    async getBootstrap() {
      return {
        deploymentId: 'blackrose-primary',
        writerEpoch: 7,
        mode: 'active',
        backendBaseUrl: null,
        databaseFingerprint: 'sha256:primary',
        writerLeaseId: authority.writerLeaseId,
        writerLeaseExpiresAt: '2099-07-28T00:00:00.000Z',
        writerLeaseIssuer: 'rosebud-operator',
        writerLeaseKeyId: 'operator-key-1',
        sourceCredentialFingerprint: 'sha256:source-a',
      };
    },
    async getOwnerState() { return null; },
    async getSourceInventory() {
      return {
        conversationCount: 0,
        messageCount: 0,
        oldestAuthoredAt: null,
        newestAuthoredAt: null,
      };
    },
  };
  return createApp({
    serverConfig: {
      port: 0,
      allowedOrigins: null,
      agentApiKey: 'legacy-key',
      readiness: {
        getSnapshot: () => ({
          ai: false,
          supabaseAuth: false,
          postgrestGateway: false,
          deploymentAuthority: false,
        }),
      },
    },
    memoryAuthMiddleware: baseAuth,
    mirrorAuthMiddleware: mirrorAuth,
    memoryRepository,
    sourceMirrorRepository: repository,
    mirrorWriteAuthority: authority,
    mirrorWritesEnabled: options.writesEnabled ?? true,
  });
}

async function withApp(
  repository: SourceMirrorRepository,
  options: { writesEnabled?: boolean } = {},
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = createMirrorApp(repository, options);
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

function makeRepository(overrides: Partial<SourceMirrorRepository> = {}): SourceMirrorRepository {
  return {
    async enroll() {
      return {
        ownerId,
        authorityState: 'MIRROR',
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
    },
    async beginImport() {
      return {
        id: 'manifest-1',
        ownerId,
        contractVersion: 1,
        datasetId,
        importGeneration: 5,
        declaredChunkCount: 1,
        sourceCount: 1,
        messageCount: 1,
        sourceHash: 'sha256:abc',
        status: 'receiving',
        completionReceipt: null,
        cancellationReceipt: null,
        latestErrorCode: null,
        completedAt: null,
        createdAt: '2026-08-01T10:00:00.000Z',
      };
    },
    async getImport() {
      throw new SourceMirrorRepositoryError('MIRROR_NOT_FOUND', 404, null);
    },
    async acceptChunk() {
      return {
        chunkIndex: 0,
        itemCount: 1,
        conversationCount: 1,
        messageCount: 1,
        chunkHash: 'sha256:abc',
        payloadHash: 'sha256:abc',
        receipt: 'mirror-chunk:manifest-1:0:sha256:abc',
        status: 'accepted' as const,
      };
    },
    async cancelImport() { throw new Error('not used'); },
    async validateImport() { throw new Error('not used'); },
    async prepareCompletion() { throw new Error('not used'); },
    async completeImport() { throw new Error('not used'); },
    async applyTombstone() { throw new Error('not used'); },
    async getParity() {
      return {
        authorityState: 'MIRROR' as const,
        authorityVersion: 3,
        sourceSetVersion: 2,
        sourceSetReceipt: 'mirror-union:manifest-1:2:sha256:abc',
        conversationCount: 1,
        messageCount: 1,
        sourceSetHash: 'sha256:abc',
      };
    },
    ...overrides,
  };
}

describe('source mirror app integration', () => {
  it('rejects pre-existing anonymous JWTs even with the authenticated role', async () => {
    await withApp(makeRepository(), {}, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/memory/mirror/imports`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${anonymousToken}`,
        },
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
      assert.equal(response.status, 401);
    });
  });

  it('requires the verified sub, auth user ID, and session id to agree', async () => {
    await withApp(makeRepository(), {}, async (baseUrl) => {
      for (const token of [wrongSubToken, noSessionToken]) {
        const response = await fetch(`${baseUrl}/v1/memory/mirror/parity`, {
          headers: { authorization: `Bearer ${token}` },
        });
        assert.equal(response.status, 401, token);
        const payload = await response.json() as { error: { code: string } };
        assert.equal(payload.error.code, 'MEMORY_AUTH_INVALID');
      }
    });
  });

  it('rejects a revoked session with 401 even while the token is still valid', async () => {
    const repository = makeRepository({
      async getParity() {
        throw new SourceMirrorRepositoryError('MIRROR_UNAUTHORIZED', 401, null);
      },
    });
    await withApp(repository, {}, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/v1/memory/mirror/parity`, {
        headers: { authorization: `Bearer ${verifiedToken}` },
      });
      assert.equal(response.status, 401);
      const payload = await response.json() as { error: { code: string } };
      assert.equal(payload.error.code, 'MIRROR_UNAUTHORIZED');
    });
  });

  it('keeps GET parity healthy while the kill switch rejects writes', async () => {
    await withApp(makeRepository(), { writesEnabled: false }, async (baseUrl) => {
      const mutation = await fetch(`${baseUrl}/v1/memory/mirror/enroll`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${verifiedToken}`,
        },
        body: JSON.stringify({ datasetId }),
      });
      assert.equal(mutation.status, 503);
      const mutationBody = await mutation.json() as { error: { code: string } };
      assert.equal(mutationBody.error.code, 'MIRROR_WRITES_DISABLED');

      const parity = await fetch(`${baseUrl}/v1/memory/mirror/parity`, {
        headers: { authorization: `Bearer ${verifiedToken}` },
      });
      assert.equal(parity.status, 200);
      assert.equal(parity.headers.get('cache-control'), 'no-store');
    });
  });

  it('serves identical receipts for an identical retried begin', async () => {
    await withApp(makeRepository(), {}, async (baseUrl) => {
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
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${verifiedToken}`,
        },
        body: JSON.stringify(body),
      });
      const second = await fetch(`${baseUrl}/v1/memory/mirror/imports`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${verifiedToken}`,
        },
        body: JSON.stringify(body),
      });
      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.deepEqual(await first.json(), await second.json());
    });
  });

  it('never writes synthetic secrets to logs or responses', async () => {
    const secret = 'SUPER-SECRET-PHRASE-42';
    const repository = makeRepository({
      async acceptChunk() {
        throw new SourceMirrorRepositoryError('MIRROR_CONFLICT', 409, null);
      },
    });
    const originalError = console.error;
    const captured: string[] = [];
    console.error = (...args: unknown[]) => {
      captured.push(args.map(String).join(' '));
    };
    try {
      await withApp(repository, {}, async (baseUrl) => {
        const chunk = validMirrorChunk();
        chunk.conversations[0].messages[0] = {
          ...chunk.conversations[0].messages[0],
          content: secret,
        };
        const response = await fetch(
          `${baseUrl}/v1/memory/mirror/imports/manifest-1/chunks/0`,
          {
            method: 'PUT',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${verifiedToken}`,
            },
            body: JSON.stringify({ chunk }),
          },
        );
        assert.equal(response.status, 409);
        const serialized = JSON.stringify(await response.json());
        assert.doesNotMatch(serialized, new RegExp(secret));
      });
    } finally {
      console.error = originalError;
    }
    const logText = captured.join('\n');
    assert.doesNotMatch(logText, new RegExp(secret));
  });

  it('decodes access-token claims for sub, session id, and anonymity', () => {
    assert.deepEqual(decodeAccessTokenPayload(verifiedToken), {
      sub: ownerId,
      sessionId,
      isAnonymous: false,
    });
    assert.deepEqual(decodeAccessTokenPayload(anonymousToken), {
      sub: ownerId,
      sessionId,
      isAnonymous: true,
    });
    assert.equal(decodeAccessTokenPayload('not-a-jwt'), null);
    assert.equal(decodeAccessTokenPayload('a.b'), null);
  });
});
