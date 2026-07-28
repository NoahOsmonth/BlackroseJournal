import type { Application, Request, RequestHandler, Response } from 'express';
import {
  MemoryRepositoryError,
  type BootstrapState,
  type MemoryRepository,
} from '../repositories/memoryRepository';

interface MemoryRoutesDeps {
  authMiddleware: RequestHandler;
  repository: MemoryRepository;
}

const DISABLED_FLAGS = {
  cloudSourceMirroring: false,
  cloudProjectionBuild: false,
  shadowRetrieval: false,
  cloudReadAuthority: false,
  cloudWriteAuthority: false,
} as const;

function ownerIdFrom(res: Response): string | null {
  const auth: unknown = res.locals.memoryAuth;
  if (
    !auth
    || typeof auth !== 'object'
    || !('ownerId' in auth)
    || typeof auth.ownerId !== 'string'
  ) {
    return null;
  }
  return auth.ownerId;
}

function sendUnavailable(
  res: Response,
  code: 'MEMORY_AUTHORITY_UNAVAILABLE' | 'MEMORY_DATA_UNAVAILABLE',
): void {
  res.status(503).json({
    error: {
      code,
      message: code === 'MEMORY_AUTHORITY_UNAVAILABLE'
        ? 'Memory authority unavailable.'
        : 'Memory data unavailable.',
    },
  });
}

function sendMissingAuth(res: Response): void {
  res.status(401).json({
    error: {
      code: 'MEMORY_AUTH_INVALID',
      message: 'Missing or invalid Authorization header.',
    },
  });
}

export function registerMemoryRoutes(
  app: Application,
  deps: MemoryRoutesDeps,
): void {
  app.use('/v1/memory', deps.authMiddleware);
  app.use('/v1/memory', (_req: Request, res: Response, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/v1/memory/bootstrap', async (_req: Request, res: Response) => {
    if (!ownerIdFrom(res)) {
      sendMissingAuth(res);
      return;
    }
    try {
      res.json({ data: await deps.repository.getBootstrap() });
    } catch (error) {
      sendUnavailable(
        res,
        error instanceof MemoryRepositoryError
          ? 'MEMORY_AUTHORITY_UNAVAILABLE'
          : 'MEMORY_DATA_UNAVAILABLE',
      );
    }
  });

  app.get('/v1/memory/state', async (_req: Request, res: Response) => {
    const ownerId = ownerIdFrom(res);
    if (!ownerId) {
      sendMissingAuth(res);
      return;
    }
    let bootstrap: BootstrapState;
    try {
      bootstrap = await deps.repository.getBootstrap();
    } catch (error) {
      sendUnavailable(
        res,
        error instanceof MemoryRepositoryError
          ? 'MEMORY_AUTHORITY_UNAVAILABLE'
          : 'MEMORY_DATA_UNAVAILABLE',
      );
      return;
    }

    try {
      const state = await deps.repository.getOwnerState(ownerId);
      res.json({
        data: {
          ownerId,
          deploymentId: bootstrap.deploymentId,
          writerEpoch: bootstrap.writerEpoch,
          authorityVersion: state?.authorityVersion ?? 0,
          authorityState: state?.authorityState ?? 'LOCAL',
          featureFlags: state?.featureFlags ?? DISABLED_FLAGS,
        },
      });
    } catch {
      sendUnavailable(res, 'MEMORY_DATA_UNAVAILABLE');
    }
  });

  app.get('/v1/memory/inventory', async (_req: Request, res: Response) => {
    const ownerId = ownerIdFrom(res);
    if (!ownerId) {
      sendMissingAuth(res);
      return;
    }
    try {
      res.json({
        data: {
          ownerId,
          ...await deps.repository.getSourceInventory(ownerId),
        },
      });
    } catch {
      sendUnavailable(res, 'MEMORY_DATA_UNAVAILABLE');
    }
  });
}
