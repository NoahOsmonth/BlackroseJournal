import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  AuthenticationError,
  createRemoteJwksProvider,
  createSupabaseJwtVerifier,
  JwksProvider,
} from '../supabaseJwtVerifier';

const ISSUER = 'https://project.supabase.co/auth/v1';
const AUDIENCE = 'authenticated';
const KEY_ID = 'key-1';

const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = keyPair.publicKey.export({ format: 'jwk' });
const ecKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const ecPublicJwk = ecKeyPair.publicKey.export({ format: 'jwk' });

function base64Url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function signJwt(payload: Record<string, unknown>, header: Record<string, unknown> = {
  alg: 'RS256',
  kid: KEY_ID,
  typ: 'JWT',
}): string {
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${signer.sign(keyPair.privateKey).toString('base64url')}`;
}

function signEsJwt(payload: Record<string, unknown>): string {
  const encodedHeader = base64Url(JSON.stringify({ alg: 'ES256', kid: 'ec-key', typ: 'JWT' }));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign('SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign({ key: ecKeyPair.privateKey, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${signature.toString('base64url')}`;
}

function claims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: ISSUER,
    aud: AUDIENCE,
    exp: Math.floor(Date.now() / 1000) + 300,
    iat: Math.floor(Date.now() / 1000) - 10,
    sub: 'user-123',
    role: 'authenticated',
    ...overrides,
  };
}

function createProvider(): JwksProvider {
  return {
    getJwks: async () => ({
      keys: [{ ...publicJwk, alg: 'RS256', kid: KEY_ID, key_ops: ['verify'] }],
    }),
  };
}

describe('Supabase JWT verifier', () => {
  it('returns only authenticated identity claims after signature and claim verification', async () => {
    const verifier = createSupabaseJwtVerifier({
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksProvider: createProvider(),
      clock: () => new Date(),
    });

    const principal = await verifier.verify(signJwt(claims({
      email: 'person@example.com',
      user_metadata: { admin: true },
    })));

    assert.deepEqual(principal, {
      userId: 'user-123',
      role: 'authenticated',
      email: 'person@example.com',
    });
  });

  it('rejects tokens with invalid issuer, audience, expiry, subject, or algorithm', async () => {
    const verifier = createSupabaseJwtVerifier({
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksProvider: createProvider(),
      clock: () => new Date(),
    });
    const invalidTokens = [
      signJwt(claims({ iss: 'https://attacker.example/auth/v1' })),
      signJwt(claims({ iss: `${ISSUER}/` })),
      signJwt(claims({ aud: 'anon' })),
      signJwt(claims({ exp: Math.floor(Date.now() / 1000) - 1 })),
      signJwt(claims({ sub: '' })),
      signJwt(claims(), { alg: 'none', kid: KEY_ID }),
      signJwt(claims(), { alg: 'EdDSA', kid: KEY_ID }),
    ];

    for (const token of invalidTokens) {
      await assert.rejects(() => verifier.verify(token), AuthenticationError);
    }
  });

  it('accepts a valid ES256 token and rejects a malformed ES256 signature', async () => {
    const verifier = createSupabaseJwtVerifier({
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksProvider: {
        getJwks: async () => ({
          keys: [{ ...ecPublicJwk, alg: 'ES256', kid: 'ec-key', key_ops: ['verify'], use: 'sig' }],
        }),
      },
    });
    const valid = signEsJwt(claims());

    assert.equal((await verifier.verify(valid)).userId, 'user-123');
    await assert.rejects(
      () => verifier.verify(`${valid.slice(0, valid.lastIndexOf('.') + 1)}AA`),
      AuthenticationError,
    );
  });

  it('rejects JWKs designated for encryption rather than signatures', async () => {
    const verifier = createSupabaseJwtVerifier({
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksProvider: {
        getJwks: async () => ({
          keys: [{ ...publicJwk, alg: 'RS256', kid: KEY_ID, key_ops: ['verify'], use: 'enc' }],
        }),
      },
    });

    await assert.rejects(() => verifier.verify(signJwt(claims())), AuthenticationError);
  });

  it('rejects an unknown key id instead of trying an arbitrary key', async () => {
    const verifier = createSupabaseJwtVerifier({
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksProvider: createProvider(),
    });

    await assert.rejects(
      () => verifier.verify(signJwt(claims(), { alg: 'RS256', kid: 'unknown' })),
      AuthenticationError,
    );
  });

  it('normalizes malformed signatures to a generic authentication error', async () => {
    const verifier = createSupabaseJwtVerifier({
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksProvider: createProvider(),
    });
    const token = signJwt(claims());
    const malformed = `${token.slice(0, token.lastIndexOf('.') + 1)}AA`;

    await assert.rejects(() => verifier.verify(malformed), AuthenticationError);
  });

  it('bounds and caches successful remote JWKS responses', async () => {
    let requests = 0;
    const provider = createRemoteJwksProvider({
      jwksUrl: `${ISSUER}/.well-known/jwks.json`,
      cacheTtlMs: 60_000,
      fetcher: async () => {
        requests += 1;
        return new Response(JSON.stringify({
          keys: [{ ...publicJwk, alg: 'RS256', kid: KEY_ID, key_ops: ['verify'] }],
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      },
    });

    assert.deepEqual(await provider.getJwks(), await provider.getJwks());
    assert.equal(requests, 1);
    provider.invalidate();
    await provider.getJwks();
    assert.equal(requests, 2);
  });

  it('stops reading an oversized JWKS response as soon as the byte limit is crossed', async () => {
    let pulls = 0;
    const provider = createRemoteJwksProvider({
      jwksUrl: `${ISSUER}/.well-known/jwks.json`,
      fetcher: async () => new Response(new ReadableStream<Uint8Array>({
        pull(controller) {
          pulls += 1;
          if (pulls > 100) {
            controller.close();
            return;
          }
          controller.enqueue(new Uint8Array(2_048));
        },
      }), { status: 200 }),
    });

    await assert.rejects(() => provider.getJwks(), AuthenticationError);
    assert.ok(pulls < 100, `expected bounded streaming reads, received ${pulls} chunks`);
  });

  it('rate-limits unknown-kid refreshes and recovers after the rotation interval', async () => {
    let requests = 0;
    let rotated = false;
    let now = Date.now();
    const provider = createRemoteJwksProvider({
      jwksUrl: `${ISSUER}/.well-known/jwks.json`,
      cacheTtlMs: 60_000,
      fetcher: async () => {
        requests += 1;
        return new Response(JSON.stringify({
          keys: [{
            ...publicJwk,
            alg: 'RS256',
            kid: rotated ? 'rotated-key' : KEY_ID,
            key_ops: ['verify'],
          }],
        }), { status: 200 });
      },
    });
    const verifier = createSupabaseJwtVerifier({
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksProvider: provider,
      clock: () => new Date(now),
      unknownKidRefreshCooldownMs: 30_000,
    });

    await assert.rejects(
      () => verifier.verify(signJwt(claims(), { alg: 'RS256', kid: 'forged-a' })),
      AuthenticationError,
    );
    await assert.rejects(
      () => verifier.verify(signJwt(claims(), { alg: 'RS256', kid: 'forged-b' })),
      AuthenticationError,
    );
    assert.equal(requests, 2, 'one initial fetch and only one unknown-kid refresh');

    rotated = true;
    now += 30_001;
    const principal = await verifier.verify(signJwt(claims(), {
      alg: 'RS256',
      kid: 'rotated-key',
    }));
    assert.equal(principal.userId, 'user-123');
    assert.equal(requests, 3, 'rotation is fetched after the cooldown');
  });
});
