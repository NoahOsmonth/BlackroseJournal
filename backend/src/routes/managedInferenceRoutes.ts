import { once } from 'node:events';
import type { Application, Request, Response } from 'express';
import {
  ContractValidationError,
  parseNormalizedInferenceRequest,
  type NormalizedInferenceEvent,
} from '../../../packages/ai-control-plane-contracts/src';
import type { ManagedInferenceService } from '../inference/managedInferenceService';
import { ManagedInferenceLimitError } from '../inference/managedInferenceLimiter';

export type ManagedInferenceRouteService = Pick<ManagedInferenceService, 'execute'>;

function userId(res: Response): string | null {
  const principal: unknown = res.locals.authenticatedPrincipal;
  if (typeof principal !== 'object' || principal === null) return null;
  const value = (principal as { userId?: unknown }).userId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function safeError(res: Response, error: unknown): void {
  if (error instanceof ManagedInferenceLimitError) {
    res.setHeader('retry-after', String(error.retryAfterSeconds));
    res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Managed inference quota exceeded.' },
    });
    return;
  }
  if (error instanceof ContractValidationError) {
    res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Request is invalid.' } });
    return;
  }
  res.status(503).json({
    error: { code: 'SERVICE_UNAVAILABLE', message: 'Managed inference is unavailable.' },
  });
}

async function writeSse(res: Response, event: NormalizedInferenceEvent): Promise<void> {
  if (res.destroyed || res.writableEnded) return;
  if (!res.write(`data: ${JSON.stringify(event)}\n\n`)) {
    await Promise.race([once(res, 'drain'), once(res, 'close')]);
  }
}

export function registerManagedInferenceRoutes(
  app: Application,
  service?: ManagedInferenceRouteService,
): void {
  app.post('/v1/ai/chat/completions', (req: Request, res: Response) => {
    void (async () => {
      const principalId = userId(res);
      if (!principalId) throw new Error('Managed inference unavailable.');
      const request = parseNormalizedInferenceRequest(req.body);
      const controller = new AbortController();
      const abort = () => controller.abort();
      req.once('aborted', abort);
      res.once('close', abort);
      try {
        if (!service) throw new Error('Managed inference unavailable.');
        const events = service.execute(principalId, request, controller.signal);
        if (!request.stream) {
          const collected: NormalizedInferenceEvent[] = [];
          for await (const event of events) collected.push(event);
          res.json({ events: collected });
          return;
        }
        const iterator = events[Symbol.asyncIterator]();
        let next = await iterator.next();
        res.status(200);
        res.setHeader('content-type', 'text/event-stream; charset=utf-8');
        res.setHeader('cache-control', 'no-cache, no-transform');
        res.setHeader('connection', 'keep-alive');
        res.flushHeaders();
        while (!next.done) {
          await writeSse(res, next.value);
          next = await iterator.next();
        }
        res.end('data: [DONE]\n\n');
      } finally {
        req.off('aborted', abort);
        res.off('close', abort);
      }
    })().catch((error) => {
      if (!res.headersSent) safeError(res, error);
      else if (!res.destroyed && !res.writableEnded) {
        void (async () => {
          await writeSse(res, {
            type: 'error',
            error: {
              code: 'internal_error',
              message: 'Managed inference failed.',
              retryable: false,
            },
          });
          await writeSse(res, { type: 'completion', reason: 'error' });
          res.end('data: [DONE]\n\n');
        })();
      }
    });
  });
}
