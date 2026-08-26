import {
  createHindsightMemoryGateway,
  type HindsightMemoryGateway,
} from './hindsightMemoryGateway';

export interface MemoryGatewayConfig {
  baseUrl: string;
  apiKey?: string;
  bankKey: Buffer;
  bankKeyVersion: number;
  requestTimeoutMs: number;
  maxResponseBytes: number;
}

type Environment = Readonly<Record<string, string | undefined>>;

function required(env: Environment, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Required Hindsight memory bank configuration is missing: ${key}.`);
  return value;
}

export function loadMemoryGatewayConfig(env: Environment): MemoryGatewayConfig {
  const rawBaseUrl = required(env, 'HINDSIGHT_BASE_URL');
  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(rawBaseUrl);
  } catch {
    throw new Error('Required Hindsight base URL is invalid.');
  }
  if (
    !['http:', 'https:'].includes(parsedBaseUrl.protocol)
    || parsedBaseUrl.username
    || parsedBaseUrl.password
    || parsedBaseUrl.search
    || parsedBaseUrl.hash
  ) throw new Error('Required Hindsight base URL is invalid.');

  const encodedKey = required(env, 'HINDSIGHT_MEMORY_BANK_HMAC_KEY_BASE64');
  const bankKey = Buffer.from(encodedKey, 'base64');
  if (bankKey.byteLength < 32 || bankKey.toString('base64') !== encodedKey) {
    throw new Error('Required memory bank HMAC key must be canonical base64 for at least 32 bytes.');
  }
  const bankKeyVersion = Number(required(env, 'HINDSIGHT_MEMORY_BANK_KEY_VERSION'));
  if (!Number.isInteger(bankKeyVersion) || bankKeyVersion < 1) {
    throw new Error('Required memory bank key version must be a positive integer.');
  }

  return Object.freeze({
    baseUrl: parsedBaseUrl.toString().replace(/\/$/, ''),
    ...(env.HINDSIGHT_API_KEY?.trim() ? { apiKey: env.HINDSIGHT_API_KEY.trim() } : {}),
    bankKey: Buffer.from(bankKey),
    bankKeyVersion,
    requestTimeoutMs: 75_000,
    maxResponseBytes: 2 * 1024 * 1024,
  });
}

const MEMORY_CONFIG_KEYS = [
  'HINDSIGHT_BASE_URL',
  'HINDSIGHT_API_KEY',
  'HINDSIGHT_MEMORY_BANK_HMAC_KEY_BASE64',
  'HINDSIGHT_MEMORY_BANK_KEY_VERSION',
] as const;

export function createMemoryGatewayFromEnvironment(
  env: Environment,
): HindsightMemoryGateway | undefined {
  if (!MEMORY_CONFIG_KEYS.some((key) => Boolean(env[key]?.trim()))) return undefined;
  return createHindsightMemoryGateway(loadMemoryGatewayConfig(env));
}
