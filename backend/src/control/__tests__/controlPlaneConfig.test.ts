import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { createControlPlaneFromEnvironment } from '../controlPlaneConfig';

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
