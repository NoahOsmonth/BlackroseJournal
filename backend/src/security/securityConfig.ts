import {
  createRemoteJwksProvider,
  createSupabaseJwtVerifier,
} from '../auth/supabaseJwtVerifier';
import { createControlAdminAuthorizer } from '../auth/adminAuthorization';
import { createSupabaseControlAdminRepository } from '../auth/supabaseAdminRepository';
import type { ManagedAccessDependencies } from '../control/managedAccess';
import type { MasterKey, MasterKeyProvider } from './envelopeEncryption';

type Environment = Readonly<Record<string, string | undefined>>;

class EnvironmentMasterKeyProvider implements MasterKeyProvider {
  readonly currentVersion: number;
  #key: Buffer;

  constructor(version: number, key: Buffer) {
    this.currentVersion = version;
    this.#key = Buffer.from(key);
  }

  async getCurrentKey(): Promise<MasterKey> {
    return { version: this.currentVersion, key: Buffer.from(this.#key) };
  }

  async getKey(version: number): Promise<Uint8Array | null> {
    return version === this.currentVersion ? Buffer.from(this.#key) : null;
  }

  toJSON(): { currentVersion: number } {
    return { currentVersion: this.currentVersion };
  }
}

export interface ManagedSecurityConfig {
  issuer: string;
  audience: string;
  jwksUrl: string;
  masterKeyProvider: MasterKeyProvider & { currentVersion: number };
}

function required(env: Environment, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Required managed security configuration is missing: ${key}.`);
  return value;
}

export function loadManagedSecurityConfig(env: Environment): ManagedSecurityConfig {
  const issuer = required(env, 'SUPABASE_JWT_ISSUER');
  const audience = required(env, 'SUPABASE_JWT_AUDIENCE');
  const jwksUrl = required(env, 'SUPABASE_JWKS_URL');
  let issuerUrl: URL;
  let parsedJwksUrl: URL;
  try {
    issuerUrl = new URL(issuer);
    parsedJwksUrl = new URL(jwksUrl);
  } catch {
    throw new Error('Required managed security URL configuration is invalid.');
  }
  if (env.NODE_ENV === 'production' && (
    issuerUrl.protocol !== 'https:' || parsedJwksUrl.protocol !== 'https:'
  )) {
    throw new Error('Required managed security URLs must use HTTPS in production.');
  }
  const version = Number(required(env, 'AI_CREDENTIAL_MASTER_KEY_VERSION'));
  if (!Number.isInteger(version) || version < 1) {
    throw new Error('Required credential master key version is invalid.');
  }
  const encoded = required(env, 'AI_CREDENTIAL_MASTER_KEY_BASE64');
  const key = Buffer.from(encoded, 'base64');
  if (key.byteLength !== 32 || key.toString('base64') !== encoded) {
    throw new Error('Required credential master key must be canonical base64 for 32 bytes.');
  }
  return {
    issuer,
    audience,
    jwksUrl: parsedJwksUrl.toString(),
    masterKeyProvider: new EnvironmentMasterKeyProvider(version, key),
  };
}

const MANAGED_CONFIG_KEYS = [
  'SUPABASE_JWT_ISSUER',
  'SUPABASE_JWT_AUDIENCE',
  'SUPABASE_JWKS_URL',
  'SUPABASE_CONTROL_REST_URL',
  'SUPABASE_SECRET_KEY',
  'AI_CREDENTIAL_MASTER_KEY_VERSION',
  'AI_CREDENTIAL_MASTER_KEY_BASE64',
] as const;

export function createManagedAccessFromEnvironment(
  env: Environment,
  fetcher?: typeof fetch,
): ManagedAccessDependencies | undefined {
  const hasManagedSetting = MANAGED_CONFIG_KEYS.some((key) => Boolean(env[key]?.trim()));
  if (env.NODE_ENV !== 'production' && !hasManagedSetting) return undefined;
  const config = loadManagedSecurityConfig(env);
  const controlRestUrl = required(env, 'SUPABASE_CONTROL_REST_URL');
  const secretKey = required(env, 'SUPABASE_SECRET_KEY');
  let parsedControlRestUrl: URL;
  try {
    parsedControlRestUrl = new URL(controlRestUrl);
  } catch {
    throw new Error('Required Supabase control REST URL is invalid.');
  }
  if (env.NODE_ENV === 'production' && parsedControlRestUrl.protocol !== 'https:') {
    throw new Error('Required Supabase control REST URL must use HTTPS in production.');
  }
  return {
    verifier: createSupabaseJwtVerifier({
      issuer: config.issuer,
      audience: config.audience,
      jwksProvider: createRemoteJwksProvider({ jwksUrl: config.jwksUrl, fetcher }),
    }),
    adminAuthorizer: createControlAdminAuthorizer(createSupabaseControlAdminRepository({
      restUrl: parsedControlRestUrl.toString(),
      secretKey,
      fetcher,
    })),
  };
}
