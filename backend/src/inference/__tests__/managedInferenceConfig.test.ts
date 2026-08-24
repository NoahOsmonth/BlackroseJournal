import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { createManagedInferenceFromEnvironment } from '../managedInferenceConfig';

describe('managed inference environment wiring', () => {
  it('is disabled only when development is wholly unconfigured', () => {
    assert.equal(createManagedInferenceFromEnvironment({ NODE_ENV: 'development' }), undefined);
    assert.throws(() => createManagedInferenceFromEnvironment({
      NODE_ENV: 'development', SUPABASE_CONTROL_REST_URL: 'https://project.supabase.co/rest/v1',
    }), /required/i);
  });

  it('builds the service from server-only Supabase and credential-key settings', () => {
    const service = createManagedInferenceFromEnvironment({
      NODE_ENV: 'production',
      SUPABASE_JWT_ISSUER: 'https://project.supabase.co/auth/v1',
      SUPABASE_JWT_AUDIENCE: 'authenticated',
      SUPABASE_JWKS_URL: 'https://project.supabase.co/auth/v1/.well-known/jwks.json',
      SUPABASE_CONTROL_REST_URL: 'https://project.supabase.co/rest/v1',
      SUPABASE_SECRET_KEY: 'server-secret',
      AI_CREDENTIAL_MASTER_KEY_VERSION: '1',
      AI_CREDENTIAL_MASTER_KEY_BASE64: randomBytes(32).toString('base64'),
    });

    assert.equal(typeof service?.execute, 'function');
    assert.doesNotMatch(JSON.stringify(service), /server-secret/);
  });
});
