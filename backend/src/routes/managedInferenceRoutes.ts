import { once } from 'node:events';
import type { Application, Request, Response } from 'express';
import {
  ContractValidationError,
  parseNormalizedInferenceRequest,
  type NormalizedInferenceEvent,
} from '../../../packages/ai-control-plane-contracts/src';
import type { ManagedInferenceService } from '../inference/managedInferenceService';
import { ManagedInferenceLimitError } from '../inference/managedInferenceLimiter';
import type { OmnirouteChatRequest } from '../inference/omnirouteInferenceExecutor';

/** The global fetch Response (express's Response shadows the global name). */
type UpstreamResponse = Awaited<ReturnType<typeof fetch>>;

export type ManagedInferenceRouteService = Pick<ManagedInferenceService, 'execute'>;

/**
 * OmniRoute inference path, gated by the ADMIN_OMNIROUTE feature flag.
 * When enabled, the route resolves the caller's per-user OmniRoute key and
 * forwards chat completions to the OmniRoute data plane instead of the legacy
 * managed-inference pipeline.
 */
export interface OmnirouteRouteIntegration {
  enabled: boolean;
  publishedModels(): Promise<string[]>;
  ensureUserKey(userId: string, allowedModels: string[]): Promise<string>;
  chat(req: OmnirouteChatRequest, signal?: AbortSignal): Promise<UpstreamResponse>;
}

/** ADMIN_OMNIROUTE=on enables the OmniRoute path; anything else (default) stays legacy. */
export function isOmnirouteEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.ADMIN_OMNIROUTE?.trim() === 'on';
}

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

function writeChunk(res: Response, chunk: string): Promise<void> {
  if (res.destroyed || res.writableEnded) return Promise.resolve();
  if (res.write(chunk)) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      res.off('drain', done);
      res.off('close', done);
      resolve();
    };
    res.once('drain', done);
    res.once('close', done);
  });
}

async function handleOmnirouteChat(
  req: Request,
  res: Response,
  principalId: string,
  request: ReturnType<typeof parseNormalizedInferenceRequest>,
  omniroute: OmnirouteRouteIntegration,
  signal: AbortSignal,
): Promise<void> {
  const publishedModels = await omniroute.publishedModels();
  const requestedModel = (req.body as { model?: unknown } | undefined)?.model;
  const model = typeof requestedModel === 'string' && requestedModel.trim().length > 0
    ? requestedModel.trim()
    : undefined;
  // Free models only: an explicitly requested model must be in the published set.
  if (model && !publishedModels.includes(model)) {
    res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'Requested model is not available.' },
    });
    return;
  }
  const resolvedModel = model ?? publishedModels[0];
  if (!resolvedModel) {
    res.status(503).json({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'No OmniRoute models are published.' },
    });
    return;
  }
  await omniroute.ensureUserKey(principalId, publishedModels);
  const upstream = await omniroute.chat(
    { userId: principalId, model: resolvedModel, messages: request.messages },
    signal,
  );
  const contentType = upstream.headers.get('content-type') ?? '';
  if (!upstream.ok || !upstream.body || !contentType.includes('text/event-stream')) {
    const body = await upstream.text();
    res.status(upstream.status).type(contentType || 'application/json').send(body);
    return;
  }
  res.status(upstream.status);
  res.setHeader('content-type', contentType);
  res.setHeader('cache-control', 'no-cache, no-transform');
  res.setHeader('connection', 'keep-alive');
  res.flushHeaders();
  const reader = upstream.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await writeChunk(res, new TextDecoder().decode(value));
    }
    res.end();
  } finally {
    reader.releaseLock();
  }
}

export function registerManagedInferenceRoutes(
  app: Application,
  service?: ManagedInferenceRouteService,
  omniroute?: OmnirouteRouteIntegration,
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
        if (omniroute?.enabled) {
          await handleOmnirouteChat(req, res, principalId, request, omniroute, controller.signal);
          return;
        }
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
