import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  createManagedAccessFromEnvironment,
  loadManagedSecurityConfig,
} from '../securityConfig';

describe('managed security configuration', () => {
  it('fails closed in production when issuer, audience, JWKS URL, or master key is absent', () => {
    assert.throws(() => loadManagedSecurityConfig({ NODE_ENV: 'production' }), /required/i);
  });

  it('loads a valid external master key without exposing it in serializable config', () => {
    const encodedMasterKey = randomBytes(32).toString('base64');
    const config = loadManagedSecurityConfig({
      NODE_ENV: 'production',
      SUPABASE_JWT_ISSUER: 'https://project.supabase.co/auth/v1',
      SUPABASE_JWT_AUDIENCE: 'authenticated',
      SUPABASE_JWKS_URL: 'https://project.supabase.co/auth/v1/.well-known/jwks.json',
      AI_CREDENTIAL_MASTER_KEY_VERSION: '3',
      AI_CREDENTIAL_MASTER_KEY_BASE64: encodedMasterKey,
    });

    assert.equal(config.issuer, 'https://project.supabase.co/auth/v1');
    assert.equal(config.masterKeyProvider.currentVersion, 3);
    assert.doesNotMatch(JSON.stringify(config), new RegExp(encodedMasterKey));
  });

  it('preserves the configured issuer byte-for-byte for exact claim comparison', () => {
    const config = loadManagedSecurityConfig({
      SUPABASE_JWT_ISSUER: 'https://project.supabase.co/auth/v1/',
      SUPABASE_JWT_AUDIENCE: 'authenticated',
      SUPABASE_JWKS_URL: 'https://project.supabase.co/auth/v1/.well-known/jwks.json',
      AI_CREDENTIAL_MASTER_KEY_VERSION: '1',
      AI_CREDENTIAL_MASTER_KEY_BASE64: randomBytes(32).toString('base64'),
    });

    assert.equal(config.issuer, 'https://project.supabase.co/auth/v1/');
  });

  it('keeps managed access disabled in development unless the complete configuration is supplied', () => {
    assert.equal(createManagedAccessFromEnvironment({ NODE_ENV: 'development' }), undefined);
    assert.throws(
      () => createManagedAccessFromEnvironment({
        NODE_ENV: 'development',
        SUPABASE_JWT_ISSUER: 'https://project.supabase.co/auth/v1',
      }),
      /required/i,
    );
  });

  it('wires a server-secret Supabase control.admins repository into admin authorization', async () => {
    const encodedMasterKey = randomBytes(32).toString('base64');
    let authorization = '';
    const access = createManagedAccessFromEnvironment({
      NODE_ENV: 'production',
      SUPABASE_JWT_ISSUER: 'https://project.supabase.co/auth/v1',
      SUPABASE_JWT_AUDIENCE: 'authenticated',
      SUPABASE_JWKS_URL: 'https://project.supabase.co/auth/v1/.well-known/jwks.json',
      SUPABASE_CONTROL_REST_URL: 'https://project.supabase.co/rest/v1',
      SUPABASE_SECRET_KEY: 'server-secret-value',
      AI_CREDENTIAL_MASTER_KEY_VERSION: '3',
      AI_CREDENTIAL_MASTER_KEY_BASE64: encodedMasterKey,
    }, async (_input, init) => {
      authorization = new Headers(init?.headers).get('authorization') ?? '';
      return new Response(JSON.stringify([{ user_id: 'admin-id', role: 'owner' }]), {
        status: 200,
      });
    });

    assert.deepEqual(await access?.adminAuthorizer?.findAdmin('admin-id'), {
      userId: 'admin-id',
      role: 'owner',
    });
    assert.equal(authorization, 'Bearer server-secret-value');
    assert.doesNotMatch(JSON.stringify(access), /server-secret-value/);
  });
});
