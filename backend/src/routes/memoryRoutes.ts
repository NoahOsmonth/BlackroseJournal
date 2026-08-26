import type { Application, Request, Response } from 'express';
import {
  MemoryGatewayResponseError,
  MemoryGatewayTimeoutError,
  type HindsightMemoryGateway,
} from '../memory/hindsightMemoryGateway';
import {
  containsBankSelector,
  parseMemoryRequest,
  type MemoryOperation,
} from '../memory/memoryRequest';

function authenticatedUserId(res: Response): string | null {
  const principal: unknown = res.locals.authenticatedPrincipal;
  if (typeof principal !== 'object' || principal === null) return null;
  const userId = (principal as { userId?: unknown }).userId;
  return typeof userId === 'string' && userId.length > 0 ? userId : null;
}

function hasClientBankSelector(req: Request): boolean {
  return containsBankSelector(req.query) || containsBankSelector(req.body);
}

function sendMemoryError(res: Response, error: unknown): void {
  if (error instanceof MemoryGatewayTimeoutError) {
    res.status(504).json({
      error: { code: 'GATEWAY_TIMEOUT', message: 'Memory service timed out.' },
    });
    return;
  }
  if (error instanceof MemoryGatewayResponseError) {
    res.status(502).json({
      error: { code: 'BAD_GATEWAY', message: 'Memory service returned an invalid response.' },
    });
    return;
  }
  res.status(503).json({
    error: { code: 'SERVICE_UNAVAILABLE', message: 'Memory service is unavailable.' },
  });
}

export function registerMemoryRoutes(
  app: Application,
  gateway?: HindsightMemoryGateway,
): void {
  const run = (
    kind: MemoryOperation,
    operation: (service: HindsightMemoryGateway, userId: string, body: unknown) => Promise<unknown>,
  ) => async (req: Request, res: Response): Promise<void> => {
    if (hasClientBankSelector(req)) {
      res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Memory request is invalid.' },
      });
      return;
    }
    const body = parseMemoryRequest(kind, req.body);
    if (body === null) {
      res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Memory request is invalid.' },
      });
      return;
    }
    const userId = authenticatedUserId(res);
    if (!gateway || !userId) {
      res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Memory service is unavailable.' },
      });
      return;
    }
    try {
      res.json(await operation(gateway, userId, body));
    } catch (error) {
      sendMemoryError(res, error);
    }
  };

  app.post('/v1/memory/retain', run('retain', (service, userId, body) => service.retain(userId, body)));
  app.post('/v1/memory/recall', run('recall', (service, userId, body) => service.recall(userId, body)));
  app.post('/v1/memory/reflect', run('reflect', (service, userId, body) => service.reflect(userId, body)));
  app.post('/v1/memory/rebuild', run('rebuild', (service, userId, body) => service.rebuild(userId, body)));
  app.delete('/v1/memory', async (req: Request, res: Response): Promise<void> => {
    if (hasClientBankSelector(req)) {
      res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Memory request is invalid.' },
      });
      return;
    }
    const userId = authenticatedUserId(res);
    if (!gateway || !userId) {
      res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Memory service is unavailable.' },
      });
      return;
    }
    try {
      res.json(await gateway.clear(userId));
    } catch (error) {
      sendMemoryError(res, error);
    }
  });
}
