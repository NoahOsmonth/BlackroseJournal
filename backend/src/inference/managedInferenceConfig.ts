import { loadManagedSecurityConfig } from '../security/securityConfig';
import { executeProviderInference } from './adapters';
import {
  createInMemoryManagedInferenceLimiter,
  DEFAULT_MANAGED_INFERENCE_LIMIT_POLICY,
  type ManagedInferenceLimitPolicy,
} from './managedInferenceLimiter';
import { createManagedInferenceService, type ManagedInferenceService } from './managedInferenceService';
import { createSupabaseInferenceRepository } from './supabaseInferenceRepository';

type Environment = Readonly<Record<string, string | undefined>>;

const CONFIG_KEYS = [
  'SUPABASE_CONTROL_REST_URL',
  'SUPABASE_SECRET_KEY',
  'AI_CREDENTIAL_MASTER_KEY_VERSION',
  'AI_CREDENTIAL_MASTER_KEY_BASE64',
  'AI_CREDENTIAL_MASTER_KEY_RING_JSON',
  'AI_MANAGED_MAX_CONCURRENT_PER_USER',
  'AI_MANAGED_REQUESTS_PER_WINDOW',
  'AI_MANAGED_TOKENS_PER_WINDOW',
  'AI_MANAGED_LIMIT_WINDOW_MS',
  'AI_MANAGED_DEFAULT_OUTPUT_RESERVATION',
] as const;

function required(env: Environment, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Required managed inference configuration is missing: ${key}.`);
  return value;
}

function positiveInteger(
  env: Environment,
  key: string,
  fallback: number,
  maximum: number,
): number {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`Managed inference limiter configuration is invalid: ${key}.`);
  }
  return value;
}

export function loadManagedInferenceLimitPolicy(env: Environment): ManagedInferenceLimitPolicy {
  return {
    maxConcurrentPerUser: positiveInteger(
      env,
      'AI_MANAGED_MAX_CONCURRENT_PER_USER',
      DEFAULT_MANAGED_INFERENCE_LIMIT_POLICY.maxConcurrentPerUser,
      100,
    ),
    maxRequestsPerWindow: positiveInteger(
      env,
      'AI_MANAGED_REQUESTS_PER_WINDOW',
      DEFAULT_MANAGED_INFERENCE_LIMIT_POLICY.maxRequestsPerWindow,
      1_000_000,
    ),
    maxTokensPerWindow: positiveInteger(
      env,
      'AI_MANAGED_TOKENS_PER_WINDOW',
      DEFAULT_MANAGED_INFERENCE_LIMIT_POLICY.maxTokensPerWindow,
      1_000_000_000,
    ),
    windowMs: positiveInteger(
      env,
      'AI_MANAGED_LIMIT_WINDOW_MS',
      DEFAULT_MANAGED_INFERENCE_LIMIT_POLICY.windowMs,
      86_400_000,
    ),
    defaultOutputTokenReservation: positiveInteger(
      env,
      'AI_MANAGED_DEFAULT_OUTPUT_RESERVATION',
      DEFAULT_MANAGED_INFERENCE_LIMIT_POLICY.defaultOutputTokenReservation,
      1_000_000,
    ),
  };
}

export function createManagedInferenceFromEnvironment(
  env: Environment,
  fetcher?: typeof fetch,
): ManagedInferenceService | undefined {
  const configured = CONFIG_KEYS.some((key) => Boolean(env[key]?.trim()));
  if (env.NODE_ENV !== 'production' && !configured) return undefined;
  const security = loadManagedSecurityConfig(env);
  const restUrl = required(env, 'SUPABASE_CONTROL_REST_URL');
  const secretKey = required(env, 'SUPABASE_SECRET_KEY');
  let parsed: URL;
  try {
    parsed = new URL(restUrl);
  } catch {
    throw new Error('Required Supabase control REST URL is invalid.');
  }
  if (env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new Error('Required Supabase control REST URL must use HTTPS in production.');
  }
  return createManagedInferenceService({
    repository: createSupabaseInferenceRepository({
      restUrl: parsed.toString(),
      secretKey,
      fetcher,
    }),
    masterKeys: security.masterKeyProvider,
    execute: executeProviderInference,
    limiter: createInMemoryManagedInferenceLimiter(loadManagedInferenceLimitPolicy(env)),
  });
}
