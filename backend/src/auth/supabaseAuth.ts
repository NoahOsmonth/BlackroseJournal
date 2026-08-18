import type { NextFunction, Request, RequestHandler, Response } from 'express';

export interface MemoryAuthConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
  timeoutMs: number;
}

export interface MemoryAuthUser {
  ownerId: string;
  accessToken: string;
  sessionId: string | null;
  isAnonymous: boolean;
}

export interface DecodedAccessTokenClaims {
  sub: string;
  sessionId: string | null;
  isAnonymous: boolean;
}

export type VerifyResult =
  | { status: 'verified'; user: MemoryAuthUser }
  | { status: 'invalid' }
  | { status: 'unavailable' };

export type VerifyAccessToken = (
  token: string,
  config: MemoryAuthConfig,
) => Promise<VerifyResult>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Decodes only the access-token payload claims needed for mirror identity:
 * the subject, the explicit session id, and the anonymous flag. The signature
 * is never trusted here; validity is established separately via the auth
 * endpoint. A malformed payload yields null and the caller fails closed.
 */
export function decodeAccessTokenPayload(
  token: string,
): DecodedAccessTokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const payload = Buffer.from(parts[1] ?? '', 'base64url').toString('utf8');
    const value: unknown = JSON.parse(payload);
    if (
      typeof value !== 'object'
      || value === null
      || Array.isArray(value)
    ) {
      return null;
    }
    const record = value as Record<string, unknown>;
    if (typeof record.sub !== 'string' || record.sub === '') {
      return null;
    }
    return {
      sub: record.sub,
      sessionId: typeof record.session_id === 'string' && record.session_id !== ''
        ? record.session_id
        : null,
      isAnonymous: record.is_anonymous === true,
    };
  } catch {
    return null;
  }
}

export async function verifySupabaseAccessToken(
  token: string,
  config: MemoryAuthConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<VerifyResult> {
  try {
    const response = await fetchImpl(`${config.supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: config.supabasePublishableKey,
        authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) {
      return { status: 'invalid' };
    }

    const value: unknown = await response.json();
    if (
      typeof value !== 'object'
      || value === null
      || !('id' in value)
      || typeof value.id !== 'string'
      || !UUID.test(value.id)
    ) {
      return { status: 'invalid' };
    }

    return {
      status: 'verified',
      user: {
        ownerId: value.id,
        accessToken: token,
        sessionId: null,
        isAnonymous: false,
      },
    };
  } catch {
    return { status: 'unavailable' };
  }
}

interface MemoryAuthMiddlewareDeps {
  config: MemoryAuthConfig;
  verify?: VerifyAccessToken;
  /**
   * Strict mode for mirror mutation routes: requires a decodable access token
   * whose subject agrees with the verified auth user id, an explicit session
   * id, and a non-anonymous identity. Pre-existing anonymous JWTs are rejected
   * even though they carry Supabase's authenticated database role.
   */
  requireMirrorSession?: boolean;
}

function sendInvalid(res: Response): void {
  res.status(401).json({
    error: {
      code: 'MEMORY_AUTH_INVALID',
      message: 'Missing or invalid Authorization header.',
    },
  });
}

export function createMemoryAuthMiddleware(
  deps: MemoryAuthMiddlewareDeps,
): RequestHandler {
  const verify = deps.verify ?? verifySupabaseAccessToken;
  const requireMirrorSession = deps.requireMirrorSession ?? false;

  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      sendInvalid(res);
      return;
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      sendInvalid(res);
      return;
    }

    const result = await verify(token, deps.config);
    if (result.status === 'invalid') {
      sendInvalid(res);
      return;
    }
    if (result.status === 'unavailable') {
      res.status(503).json({
        error: {
          code: 'MEMORY_AUTH_UNAVAILABLE',
          message: 'Authentication unavailable.',
        },
      });
      return;
    }

    const claims = decodeAccessTokenPayload(token);
    if (requireMirrorSession) {
      if (
        !claims
        || claims.sub !== result.user.ownerId
        || !claims.sessionId
        || claims.isAnonymous
      ) {
        sendInvalid(res);
        return;
      }
    }

    res.locals.memoryAuth = {
      ownerId: result.user.ownerId,
      accessToken: result.user.accessToken,
      sessionId: claims?.sessionId ?? null,
      isAnonymous: claims?.isAnonymous ?? false,
    };
    next();
  };
}
