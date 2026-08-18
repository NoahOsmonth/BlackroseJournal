import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMemoryAuthMiddleware,
  decodeAccessTokenPayload,
  verifySupabaseAccessToken,
} from '../auth/supabaseAuth';

const ownerId = '00000000-0000-4000-8000-00000000000a';
const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabasePublishableKey: 'publishable-test-key',
  timeoutMs: 100,
};

describe('Supabase memory auth', () => {
  it('forwards the user token and accepts only a UUID subject', async () => {
    let headers = new Headers();
    let seenUrl = '';
    const result = await verifySupabaseAccessToken(
      'user-token',
      config,
      async (input, init) => {
        seenUrl = String(input);
        headers = new Headers(init?.headers);
        assert.ok(init?.signal);
        return new Response(JSON.stringify({ id: ownerId }), { status: 200 });
      },
    );

    assert.deepEqual(result, {
      status: 'verified',
      user: {
        ownerId,
        accessToken: 'user-token',
        sessionId: null,
        isAnonymous: false,
      },
    });
    assert.equal(seenUrl, 'https://project.supabase.co/auth/v1/user');
    assert.equal(headers.get('apikey'), 'publishable-test-key');
    assert.equal(headers.get('authorization'), 'Bearer user-token');
  });

  it('distinguishes invalid auth from upstream unavailability', async () => {
    assert.deepEqual(
      await verifySupabaseAccessToken(
        'bad',
        config,
        async () => new Response('{}', { status: 401 }),
      ),
      { status: 'invalid' },
    );
    assert.deepEqual(
      await verifySupabaseAccessToken('token', config, async () => {
        throw new Error('private network detail');
      }),
      { status: 'unavailable' },
    );
    assert.deepEqual(
      await verifySupabaseAccessToken(
        'token',
        config,
        async () => new Response(JSON.stringify({ id: 'not-a-uuid' }), {
          status: 200,
        }),
      ),
      { status: 'invalid' },
    );
    assert.deepEqual(
      await verifySupabaseAccessToken(
        'token',
        config,
        async () => new Response('{broken', { status: 200 }),
      ),
      { status: 'unavailable' },
    );
  });

  it('returns stable redacted middleware errors', async () => {
    const middleware = createMemoryAuthMiddleware({
      config,
      verify: async () => ({ status: 'unavailable' }),
    });
    const req = { headers: { authorization: 'Bearer token' } } as never;
    let status = 0;
    let payload: unknown;
    const res = {
      locals: {},
      status(code: number) { status = code; return this; },
      json(value: unknown) { payload = value; return this; },
    } as never;

    await middleware(req, res, () => assert.fail('next not expected'));
    assert.equal(status, 503);
    assert.deepEqual(payload, {
      error: {
        code: 'MEMORY_AUTH_UNAVAILABLE',
        message: 'Authentication unavailable.',
      },
    });
    assert.doesNotMatch(JSON.stringify(payload), /token|network detail/i);
  });

  it('rejects missing and invalid bearer tokens without calling next', async () => {
    for (const authorization of [undefined, 'Basic value', 'Bearer bad']) {
      let verifyCalls = 0;
      const middleware = createMemoryAuthMiddleware({
        config,
        verify: async () => {
          verifyCalls += 1;
          return { status: 'invalid' };
        },
      });
      const req = { headers: { authorization } } as never;
      let status = 0;
      let payload: unknown;
      const res = {
        locals: {},
        status(code: number) { status = code; return this; },
        json(value: unknown) { payload = value; return this; },
      } as never;

      await middleware(req, res, () => assert.fail('next not expected'));
      assert.equal(status, 401);
      assert.deepEqual(payload, {
        error: {
          code: 'MEMORY_AUTH_INVALID',
          message: 'Missing or invalid Authorization header.',
        },
      });
      assert.equal(verifyCalls, authorization === 'Bearer bad' ? 1 : 0);
    }
  });

  it('attaches only the verified owner and access token', async () => {
    const middleware = createMemoryAuthMiddleware({
      config,
      verify: async () => ({
        status: 'verified',
        user: {
          ownerId,
          accessToken: 'user-token',
          sessionId: null,
          isAnonymous: false,
        },
      }),
    });
    const req = {
      headers: { authorization: 'Bearer user-token' },
    } as never;
    const locals: Record<string, unknown> = {};
    const res = { locals } as never;
    let nextCalls = 0;

    await middleware(req, res, () => { nextCalls += 1; });

    assert.equal(nextCalls, 1);
    assert.deepEqual(locals, {
      memoryAuth: {
        ownerId,
        accessToken: 'user-token',
        sessionId: null,
        isAnonymous: false,
      },
    });
  });

  it('derives session claims only from the access-token payload', () => {
    const token = [
      Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
      Buffer.from(JSON.stringify({
        sub: ownerId,
        session_id: '00000000-0000-4000-8000-0000000000ee',
        is_anonymous: false,
      })).toString('base64url'),
      'signature',
    ].join('.');
    assert.deepEqual(decodeAccessTokenPayload(token), {
      sub: ownerId,
      sessionId: '00000000-0000-4000-8000-0000000000ee',
      isAnonymous: false,
    });
    assert.equal(decodeAccessTokenPayload('not-a-jwt'), null);
    assert.equal(decodeAccessTokenPayload('a.b'), null);
  });

  it('rejects anonymous JWTs and claim mismatches for mirror mutations', async () => {
    const cases: Array<{ sub: string; sessionId: string | null; anonymous: boolean }> = [
      { sub: ownerId, sessionId: '00000000-0000-4000-8000-0000000000ee', anonymous: true },
      { sub: '00000000-0000-4000-8000-0000000000ff', sessionId: '00000000-0000-4000-8000-0000000000ee', anonymous: false },
      { sub: ownerId, sessionId: null, anonymous: false },
    ];
    for (const testCase of cases) {
      const token = [
        Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
        Buffer.from(JSON.stringify({
          sub: testCase.sub,
          ...(testCase.sessionId ? { session_id: testCase.sessionId } : {}),
          is_anonymous: testCase.anonymous,
        })).toString('base64url'),
        'signature',
      ].join('.');
      const middleware = createMemoryAuthMiddleware({
        config,
        requireMirrorSession: true,
        verify: async (candidate) => (
          candidate === token
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
      const req = { headers: { authorization: `Bearer ${token}` } } as never;
      let status = 0;
      let payload: unknown;
      let nextCalls = 0;
      const res = {
        locals: {},
        status(code: number) { status = code; return this; },
        json(value: unknown) { payload = value; return this; },
      } as never;
      await middleware(req, res, () => { nextCalls += 1; });
      assert.equal(status, 401, JSON.stringify(testCase));
      assert.deepEqual(payload, {
        error: {
          code: 'MEMORY_AUTH_INVALID',
          message: 'Missing or invalid Authorization header.',
        },
      });
      assert.equal(nextCalls, 0);
    }
  });

  it('attaches the verified session when sub, id, and session agree', async () => {
    const token = [
      Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
      Buffer.from(JSON.stringify({
        sub: ownerId,
        session_id: '00000000-0000-4000-8000-0000000000ee',
        is_anonymous: false,
      })).toString('base64url'),
      'signature',
    ].join('.');
    const middleware = createMemoryAuthMiddleware({
      config,
      requireMirrorSession: true,
      verify: async (candidate) => (
        candidate === token
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
    const req = { headers: { authorization: `Bearer ${token}` } } as never;
    const locals: Record<string, unknown> = {};
    const res = { locals } as never;
    let nextCalls = 0;
    await middleware(req, res, () => { nextCalls += 1; });
    assert.equal(nextCalls, 1);
    assert.deepEqual(locals.memoryAuth, {
      ownerId,
      accessToken: token,
      sessionId: '00000000-0000-4000-8000-0000000000ee',
      isAnonymous: false,
    });
  });
});
