import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readMemoryConfig } from '../memory/config';

const validBase = {
  SUPABASE_URL: 'https://project.supabase.co/',
  SUPABASE_ANON_KEY: 'publishable-key',
  MEMORY_DEPLOYMENT_ID: 'blackrose-primary',
  MEMORY_WRITER_LEASE_ID: '00000000-0000-4000-8000-000000000077',
  MEMORY_WRITER_LEASE_TOKEN: 'opaque-writer-token',
  MEMORY_SOURCE_CREDENTIAL_FINGERPRINT: 'sha256:source',
};

describe('memory runtime config', () => {
  it('returns only dependency booleans for empty or partial config', () => {
    assert.deepEqual(readMemoryConfig({}), {
      ready: false,
      dependencies: {
        supabaseAuth: false,
        postgrestGateway: false,
        deployment: false,
      },
    });

    const partial = readMemoryConfig({
      ...validBase,
      SUPABASE_SECRET_KEY: 'sb_secret_private-value',
      MEMORY_WRITER_LEASE_ID: 'not-a-uuid',
    });
    assert.deepEqual(partial, {
      ready: false,
      dependencies: {
        supabaseAuth: true,
        postgrestGateway: true,
        deployment: false,
      },
    });
    const serialized = JSON.stringify(partial);
    assert.doesNotMatch(serialized, /private-value|opaque-writer-token|sha256:source/);
  });

  it('accepts a modern secret key without creating a bearer credential', () => {
    assert.deepEqual(readMemoryConfig({
      ...validBase,
      MEMORY_POSTGREST_URL: 'https://gateway.example.test/rest/v1/',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
    }), {
      ready: true,
      config: {
        postgrestBaseUrl: 'https://gateway.example.test/rest/v1',
        postgrestServerKey: 'sb_secret_test',
        postgrestKeyKind: 'secret',
        deploymentId: 'blackrose-primary',
        writerLeaseId: '00000000-0000-4000-8000-000000000077',
        writerLeaseToken: 'opaque-writer-token',
        sourceCredentialFingerprint: 'sha256:source',
        auth: {
          supabaseUrl: 'https://project.supabase.co',
          supabasePublishableKey: 'publishable-key',
          timeoutMs: 3000,
        },
      },
    });
  });

  it('accepts a legacy service-role key and falls back to Supabase PostgREST', () => {
    const result = readMemoryConfig({
      ...validBase,
      SUPABASE_SERVICE_ROLE_KEY: 'legacy.jwt.value',
    });
    assert.equal(result.ready, true);
    if (!result.ready) {
      assert.fail('expected ready config');
    }
    assert.equal(result.config.postgrestBaseUrl, 'https://project.supabase.co/rest/v1');
    assert.equal(result.config.postgrestServerKey, 'legacy.jwt.value');
    assert.equal(result.config.postgrestKeyKind, 'legacy_service_role');
  });

  it('rejects credentialed URLs, blank opaque values, and unsafe deployment IDs', () => {
    for (const env of [
      { ...validBase, SUPABASE_URL: 'https://user:pass@project.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test' },
      { ...validBase, SUPABASE_SECRET_KEY: 'sb_secret_test', MEMORY_WRITER_LEASE_TOKEN: ' ' },
      { ...validBase, SUPABASE_SECRET_KEY: 'sb_secret_test', MEMORY_DEPLOYMENT_ID: '../other' },
    ]) {
      assert.equal(readMemoryConfig(env).ready, false);
    }
  });
});
