import type { NextFunction, Request, RequestHandler, Response } from 'express';

export interface MemoryAuthConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
  timeoutMs: number;
}

export interface MemoryAuthUser {
  ownerId: string;
  accessToken: string;
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
      },
    };
  } catch {
    return { status: 'unavailable' };
  }
}

interface MemoryAuthMiddlewareDeps {
  config: MemoryAuthConfig;
  verify?: VerifyAccessToken;
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

    res.locals.memoryAuth = result.user;
    next();
  };
}
