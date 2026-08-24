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
  #keys: Map<number, Buffer>;

  constructor(version: number, keys: ReadonlyMap<number, Buffer>) {
    this.currentVersion = version;
    this.#keys = new Map([...keys].map(([keyVersion, key]) => [keyVersion, Buffer.from(key)]));
  }

  async getCurrentKey(): Promise<MasterKey> {
    const key = this.#keys.get(this.currentVersion);
    if (!key) throw new Error('Credential master key is unavailable.');
    return { version: this.currentVersion, key: Buffer.from(key) };
  }

  async getKey(version: number): Promise<Uint8Array | null> {
    const key = this.#keys.get(version);
    return key ? Buffer.from(key) : null;
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

function decodeMasterKey(encoded: string, message: string): Buffer {
  const key = Buffer.from(encoded, 'base64');
  if (key.byteLength !== 32 || key.toString('base64') !== encoded) {
    throw new Error(message);
  }
  return key;
}

function loadMasterKeyRing(
  encodedRing: string | undefined,
  currentVersion: number,
  currentKey: Buffer,
): Map<number, Buffer> {
  const keys = new Map<number, Buffer>([[currentVersion, Buffer.from(currentKey)]]);
  if (!encodedRing?.trim()) return keys;
  let parsed: unknown;
  try {
    parsed = JSON.parse(encodedRing);
  } catch {
    throw new Error('Credential master key ring is invalid.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Credential master key ring is invalid.');
  }
  for (const [rawVersion, encoded] of Object.entries(parsed)) {
    if (!/^\d+$/.test(rawVersion) || Number(rawVersion) < 1 || typeof encoded !== 'string') {
      throw new Error('Credential master key ring is invalid.');
    }
    keys.set(
      Number(rawVersion),
      decodeMasterKey(encoded, 'Credential master key ring is invalid.'),
    );
  }
  if (!keys.get(currentVersion)?.equals(currentKey)) {
    throw new Error('Credential master key ring current entry does not match the current key.');
  }
  return keys;
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
  const key = decodeMasterKey(
    encoded,
    'Required credential master key must be canonical base64 for 32 bytes.',
  );
  const keyRing = loadMasterKeyRing(
    env.AI_CREDENTIAL_MASTER_KEY_RING_JSON,
    version,
    key,
  );
  return {
    issuer,
    audience,
    jwksUrl: parsedJwksUrl.toString(),
    masterKeyProvider: new EnvironmentMasterKeyProvider(version, keyRing),
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
  'AI_CREDENTIAL_MASTER_KEY_RING_JSON',
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
