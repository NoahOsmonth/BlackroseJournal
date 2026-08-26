import type { NextFunction, Request, Response } from 'express';
import type { AccessTokenVerifier } from '../auth/supabaseJwtVerifier';
import {
  AuthorizationError,
  requireAdmin,
  type AdminAuthorizer,
} from '../auth/adminAuthorization';

const MANAGED_PREFIXES = ['/v1/ai', '/v1/admin', '/v1/memory'] as const;

export interface ManagedAccessDependencies {
  verifier: AccessTokenVerifier;
  adminAuthorizer?: AdminAuthorizer;
}

export function createManagedAdminGuard(dependencies?: ManagedAccessDependencies) {
  return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (_req.method === 'OPTIONS') {
      // CORS preflights never carry Authorization; let the cors middleware answer.
      next();
      return;
    }
    if (!dependencies?.adminAuthorizer) {
      res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Administrative access is unavailable.' },
      });
      return;
    }
    try {
      const principal: unknown = res.locals.authenticatedPrincipal;
      if (
        typeof principal !== 'object'
        || principal === null
        || typeof (principal as { userId?: unknown }).userId !== 'string'
        || typeof (principal as { role?: unknown }).role !== 'string'
      ) throw new AuthorizationError();
      res.locals.adminPrincipal = await requireAdmin(
        principal as { userId: string; role: string },
        dependencies.adminAuthorizer,
      );
      next();
    } catch {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Administrative access denied.' } });
    }
  };
}

export function isManagedPath(path: string): boolean {
  return MANAGED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function createManagedOriginGuard(allowedOrigins: string[] | null) {
  const allowlist = new Set(allowedOrigins ?? []);
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    if (isManagedPath(req.path) && origin && !allowlist.has(origin)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Origin is not allowed.' } });
      return;
    }
    next();
  };
}

export function createManagedAuthGuard(dependencies?: ManagedAccessDependencies) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method === 'OPTIONS') {
      next();
      return;
    }
    if (!dependencies) {
      res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Managed access is unavailable.' },
      });
      return;
    }
    const match = req.headers.authorization?.match(/^Bearer\s+([^\s]+)$/i);
    if (!match) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
      return;
    }
    try {
      res.locals.authenticatedPrincipal = await dependencies.verifier.verify(match[1]);
      next();
    } catch {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication failed.' } });
    }
  };
}
