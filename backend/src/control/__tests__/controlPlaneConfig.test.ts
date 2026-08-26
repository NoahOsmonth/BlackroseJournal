import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { createControlPlaneFromEnvironment, createOmnirouteFromEnvironment } from '../controlPlaneConfig';

describe('control plane environment wiring', () => {
  it('stays disabled for an entirely unconfigured development environment', () => {
    assert.equal(createControlPlaneFromEnvironment({ NODE_ENV: 'development' }), undefined);
  });

  it('fails closed for partial configuration and builds a service for complete configuration', () => {
    assert.throws(() => createControlPlaneFromEnvironment({
      NODE_ENV: 'development',
      SUPABASE_CONTROL_REST_URL: 'https://project.supabase.co/rest/v1',
    }), /required/i);

    const service = createControlPlaneFromEnvironment({
      NODE_ENV: 'production',
      SUPABASE_JWT_ISSUER: 'https://project.supabase.co/auth/v1',
      SUPABASE_JWT_AUDIENCE: 'authenticated',
      SUPABASE_JWKS_URL: 'https://project.supabase.co/auth/v1/.well-known/jwks.json',
      SUPABASE_CONTROL_REST_URL: 'https://project.supabase.co/rest/v1',
      SUPABASE_SECRET_KEY: 'service-secret',
      AI_CREDENTIAL_MASTER_KEY_VERSION: '2',
      AI_CREDENTIAL_MASTER_KEY_BASE64: randomBytes(32).toString('base64'),
    }, async () => new Response('[]', { status: 200 }));

    assert.ok(service);
    assert.doesNotMatch(JSON.stringify(service), /service-secret/);
  });
});

describe('omniroute environment wiring', () => {
  it('throws without OMNIROUTE_MANAGE_KEY', () => {
    assert.throws(
      () => createOmnirouteFromEnvironment({}),
      /OMNIROUTE_MANAGE_KEY/,
    );
  });

  it('applies the default base url and an optional embedding model', () => {
    const built = createOmnirouteFromEnvironment({ OMNIROUTE_MANAGE_KEY: 'k' });
    assert.ok(built.adapter);
    assert.equal(built.embeddingModel, null);
  });

  it('honors explicit base url and embedding model overrides', () => {
    const built = createOmnirouteFromEnvironment({
      OMNIROUTE_MANAGE_KEY: 'k',
      OMNIROUTE_BASE_URL: 'http://127.0.0.1:20128',
      OMNIROUTE_EMBEDDING_MODEL: 'gemini-embedding-001',
    });
    assert.ok(built.adapter);
    assert.equal(built.embeddingModel, 'gemini-embedding-001');
  });

  it('never leaks the manage key in stringified output', () => {
    const built = createOmnirouteFromEnvironment({ OMNIROUTE_MANAGE_KEY: 'supersecret' });
    assert.doesNotMatch(JSON.stringify(built), /supersecret/);
  });
});
