import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  createManagedInferenceFromEnvironment,
  loadManagedInferenceLimitPolicy,
} from '../managedInferenceConfig';
import type { ManagedInferenceLimiter } from '../managedInferenceLimiter';

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
      AI_MANAGED_LIMITER_MODE: 'single-instance',
    });

    assert.equal(typeof service?.execute, 'function');
    assert.doesNotMatch(JSON.stringify(service), /server-secret/);
  });

  it('uses bounded production defaults and fails closed on invalid limiter overrides', () => {
    assert.deepEqual(loadManagedInferenceLimitPolicy({ NODE_ENV: 'production' }), {
      maxConcurrentPerUser: 2,
      maxRequestsPerWindow: 30,
      maxTokensPerWindow: 100_000,
      maxConcurrentPerRoute: 8,
      maxRequestsPerRouteWindow: 120,
      maxTokensPerRouteWindow: 400_000,
      windowMs: 60_000,
      defaultOutputTokenReservation: 2_048,
    });
    assert.deepEqual(loadManagedInferenceLimitPolicy({
      NODE_ENV: 'production',
      AI_MANAGED_MAX_CONCURRENT_PER_USER: '1',
      AI_MANAGED_REQUESTS_PER_WINDOW: '12',
      AI_MANAGED_TOKENS_PER_WINDOW: '4096',
      AI_MANAGED_MAX_CONCURRENT_PER_ROUTE: '3',
      AI_MANAGED_ROUTE_REQUESTS_PER_WINDOW: '24',
      AI_MANAGED_ROUTE_TOKENS_PER_WINDOW: '16384',
      AI_MANAGED_LIMIT_WINDOW_MS: '30000',
      AI_MANAGED_DEFAULT_OUTPUT_RESERVATION: '512',
    }), {
      maxConcurrentPerUser: 1,
      maxRequestsPerWindow: 12,
      maxTokensPerWindow: 4096,
      maxConcurrentPerRoute: 3,
      maxRequestsPerRouteWindow: 24,
      maxTokensPerRouteWindow: 16_384,
      windowMs: 30_000,
      defaultOutputTokenReservation: 512,
    });
    assert.throws(() => loadManagedInferenceLimitPolicy({
      NODE_ENV: 'production', AI_MANAGED_REQUESTS_PER_WINDOW: '0',
    }), /AI_MANAGED_REQUESTS_PER_WINDOW/);
    assert.throws(() => loadManagedInferenceLimitPolicy({
      NODE_ENV: 'production', AI_MANAGED_MAX_CONCURRENT_PER_USER: 'unlimited',
    }), /AI_MANAGED_MAX_CONCURRENT_PER_USER/);
  });

  it('requires explicit single-instance acknowledgement for the process-local production limiter', () => {
    const production = {
      NODE_ENV: 'production',
      SUPABASE_JWT_ISSUER: 'https://project.supabase.co/auth/v1',
      SUPABASE_JWT_AUDIENCE: 'authenticated',
      SUPABASE_JWKS_URL: 'https://project.supabase.co/auth/v1/.well-known/jwks.json',
      SUPABASE_CONTROL_REST_URL: 'https://project.supabase.co/rest/v1',
      SUPABASE_SECRET_KEY: 'server-secret',
      AI_CREDENTIAL_MASTER_KEY_VERSION: '1',
      AI_CREDENTIAL_MASTER_KEY_BASE64: randomBytes(32).toString('base64'),
    };
    assert.throws(() => createManagedInferenceFromEnvironment(production), /AI_MANAGED_LIMITER_MODE/);
    assert.throws(() => createManagedInferenceFromEnvironment({
      ...production, AI_MANAGED_LIMITER_MODE: 'distributed',
    }), /distributed limiter must be injected/i);

    const distributedLimiter: ManagedInferenceLimiter = {
      acquireUser: async () => ({ release: () => undefined }),
      acquireRoute: async () => ({ release: () => undefined }),
    };
    const service = createManagedInferenceFromEnvironment(
      { ...production, AI_MANAGED_LIMITER_MODE: 'distributed' },
      undefined,
      distributedLimiter,
    );
    assert.equal(typeof service?.execute, 'function');
  });
});
