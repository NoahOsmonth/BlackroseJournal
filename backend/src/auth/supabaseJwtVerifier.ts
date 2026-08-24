import {
  createPublicKey,
  verify as verifySignature,
  type KeyObject,
} from 'node:crypto';

export interface AuthenticatedPrincipal {
  userId: string;
  role: string;
  email?: string;
}

export interface AccessTokenVerifier {
  verify(token: string): Promise<AuthenticatedPrincipal>;
}

export interface Jwk {
  [key: string]: unknown;
  kid?: string;
  alg?: string;
  key_ops?: string[];
  kty?: string;
  crv?: string;
  e?: string;
  n?: string;
  x?: string;
  y?: string;
}

export interface JsonWebKeySet {
  keys: Jwk[];
}

export interface JwksProvider {
  getJwks(): Promise<JsonWebKeySet>;
}

export class AuthenticationError extends Error {
  constructor() {
    super('Authentication failed.');
    this.name = 'AuthenticationError';
  }
}

interface JwtHeader {
  alg: string;
  kid: string;
}

interface JwtClaims {
  iss: string;
  aud: string | string[];
  exp: number;
  nbf?: number;
  sub: string;
  role: string;
  email?: string;
}

export interface SupabaseJwtVerifierOptions {
  issuer: string;
  audience: string;
  jwksProvider: JwksProvider;
  clock?: () => Date;
  clockSkewSeconds?: number;
}

const MAX_TOKEN_BYTES = 16 * 1024;
const SUPPORTED_ALGORITHMS = new Set(['RS256', 'ES256', 'EdDSA']);

function parseJsonRecord(segment: string): Record<string, unknown> {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new AuthenticationError();
  try {
    const value: unknown = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new AuthenticationError();
    }
    return value as Record<string, unknown>;
  } catch {
    throw new AuthenticationError();
  }
}

function parseHeader(value: Record<string, unknown>): JwtHeader {
  if (
    typeof value.alg !== 'string'
    || !SUPPORTED_ALGORITHMS.has(value.alg)
    || typeof value.kid !== 'string'
    || value.kid.length === 0
  ) {
    throw new AuthenticationError();
  }
  return { alg: value.alg, kid: value.kid };
}

function parseClaims(value: Record<string, unknown>): JwtClaims {
  const audience = value.aud;
  if (
    typeof value.iss !== 'string'
    || !(typeof audience === 'string'
      || (Array.isArray(audience) && audience.every((item) => typeof item === 'string')))
    || typeof value.exp !== 'number'
    || !Number.isFinite(value.exp)
    || (value.nbf !== undefined && (typeof value.nbf !== 'number' || !Number.isFinite(value.nbf)))
    || typeof value.sub !== 'string'
    || value.sub.length === 0
    || typeof value.role !== 'string'
    || value.role.length === 0
    || (value.email !== undefined && typeof value.email !== 'string')
  ) {
    throw new AuthenticationError();
  }
  return value as unknown as JwtClaims;
}

function importVerificationKey(jwk: Jwk, algorithm: string): KeyObject {
  if (jwk.alg !== undefined && jwk.alg !== algorithm) throw new AuthenticationError();
  if (jwk.key_ops !== undefined && !jwk.key_ops.includes('verify')) {
    throw new AuthenticationError();
  }
  if (
    (algorithm === 'RS256' && jwk.kty !== 'RSA')
    || (algorithm === 'ES256' && (jwk.kty !== 'EC' || jwk.crv !== 'P-256'))
    || (algorithm === 'EdDSA' && (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519'))
  ) {
    throw new AuthenticationError();
  }
  try {
    return createPublicKey({ key: jwk, format: 'jwk' });
  } catch {
    throw new AuthenticationError();
  }
}

function verifyJwtSignature(
  algorithm: string,
  signingInput: string,
  signature: Buffer,
  key: KeyObject,
): boolean {
  if (algorithm === 'EdDSA') {
    return verifySignature(null, Buffer.from(signingInput), key, signature);
  }
  if (algorithm === 'ES256') {
    return verifySignature(
      'sha256',
      Buffer.from(signingInput),
      { key, dsaEncoding: 'ieee-p1363' },
      signature,
    );
  }
  return verifySignature('RSA-SHA256', Buffer.from(signingInput), key, signature);
}

export function createSupabaseJwtVerifier(
  options: SupabaseJwtVerifierOptions,
): AccessTokenVerifier {
  const issuer = options.issuer.replace(/\/$/, '');
  const clockSkewSeconds = Math.max(0, Math.min(options.clockSkewSeconds ?? 0, 60));
  return {
    async verify(token: string): Promise<AuthenticatedPrincipal> {
      if (!token || Buffer.byteLength(token, 'utf8') > MAX_TOKEN_BYTES) {
        throw new AuthenticationError();
      }
      const parts = token.split('.');
      if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
        throw new AuthenticationError();
      }
      const header = parseHeader(parseJsonRecord(parts[0]));
      const claims = parseClaims(parseJsonRecord(parts[1]));
      const jwks = await options.jwksProvider.getJwks().catch(() => {
        throw new AuthenticationError();
      });
      const jwk = jwks.keys.find((item) => item.kid === header.kid);
      if (!jwk) throw new AuthenticationError();
      let signature: Buffer;
      try {
        signature = Buffer.from(parts[2], 'base64url');
      } catch {
        throw new AuthenticationError();
      }
      const key = importVerificationKey(jwk, header.alg);
      if (!verifyJwtSignature(header.alg, `${parts[0]}.${parts[1]}`, signature, key)) {
        throw new AuthenticationError();
      }

      const now = Math.floor((options.clock?.() ?? new Date()).getTime() / 1_000);
      const audienceMatches = typeof claims.aud === 'string'
        ? claims.aud === options.audience
        : claims.aud.includes(options.audience);
      if (
        claims.iss.replace(/\/$/, '') !== issuer
        || !audienceMatches
        || claims.exp <= now - clockSkewSeconds
        || (claims.nbf !== undefined && claims.nbf > now + clockSkewSeconds)
        || claims.role !== 'authenticated'
      ) {
        throw new AuthenticationError();
      }
      return {
        userId: claims.sub,
        role: claims.role,
        ...(claims.email === undefined ? {} : { email: claims.email }),
      };
    },
  };
}

export interface RemoteJwksProviderOptions {
  jwksUrl: string;
  fetcher?: typeof fetch;
  cacheTtlMs?: number;
}

function parseJwks(value: unknown): JsonWebKeySet {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AuthenticationError();
  }
  const keys = (value as Record<string, unknown>).keys;
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > 20) {
    throw new AuthenticationError();
  }
  for (const key of keys) {
    if (typeof key !== 'object' || key === null || Array.isArray(key)) {
      throw new AuthenticationError();
    }
  }
  return { keys: keys as Jwk[] };
}

export function createRemoteJwksProvider(
  options: RemoteJwksProviderOptions,
): JwksProvider {
  const fetcher = options.fetcher ?? fetch;
  const cacheTtlMs = Math.max(1_000, Math.min(options.cacheTtlMs ?? 10 * 60_000, 60 * 60_000));
  let cached: { expiresAt: number; jwks: JsonWebKeySet } | null = null;
  let inFlight: Promise<JsonWebKeySet> | null = null;
  return {
    async getJwks(): Promise<JsonWebKeySet> {
      if (cached && cached.expiresAt > Date.now()) return cached.jwks;
      if (inFlight) return inFlight;
      inFlight = (async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5_000);
        timer.unref();
        try {
          const response = await fetcher(options.jwksUrl, {
            headers: { accept: 'application/json' },
            redirect: 'error',
            signal: controller.signal,
          });
          if (!response.ok) throw new AuthenticationError();
          const contentLength = Number(response.headers.get('content-length') ?? '0');
          if (contentLength > 128 * 1024) throw new AuthenticationError();
          const text = await response.text();
          if (Buffer.byteLength(text, 'utf8') > 128 * 1024) throw new AuthenticationError();
          const jwks = parseJwks(JSON.parse(text) as unknown);
          cached = { expiresAt: Date.now() + cacheTtlMs, jwks };
          return jwks;
        } catch {
          throw new AuthenticationError();
        } finally {
          clearTimeout(timer);
          inFlight = null;
        }
      })();
      return inFlight;
    },
  };
}
