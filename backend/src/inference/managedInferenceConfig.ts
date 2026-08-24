import { loadManagedSecurityConfig } from '../security/securityConfig';
import { executeProviderInference } from './adapters';
import { createManagedInferenceService, type ManagedInferenceService } from './managedInferenceService';
import { createSupabaseInferenceRepository } from './supabaseInferenceRepository';

type Environment = Readonly<Record<string, string | undefined>>;

const CONFIG_KEYS = [
  'SUPABASE_CONTROL_REST_URL',
  'SUPABASE_SECRET_KEY',
  'AI_CREDENTIAL_MASTER_KEY_VERSION',
  'AI_CREDENTIAL_MASTER_KEY_BASE64',
  'AI_CREDENTIAL_MASTER_KEY_RING_JSON',
] as const;

function required(env: Environment, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Required managed inference configuration is missing: ${key}.`);
  return value;
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
  });
}
