import type { OmnirouteKeysService } from '../control/omnirouteKeysService';
import { OmnirouteAdminValidationError } from '../control/omnirouteAdminService';

class SupabaseControlRepositoryError extends Error {
  readonly name = 'SupabaseControlRepositoryError';
}

export interface OmnirouteKeysRouteDeps {
  keys?: OmnirouteKeysService;
}

/**
 * Task 7: thin admin proxy for per-user key management, usage analytics and
 * embeddings settings. All routes sit under `/v1/admin`, so the managed auth +
 * admin guards from `app.ts` apply automatically.
 */
export function registerOmnirouteKeysRoutes(
  app: import('express').Application,
  deps: OmnirouteKeysRouteDeps,
): void {
  const requireKeys = (): OmnirouteKeysService => {
    if (!deps.keys) throw new SupabaseControlRepositoryError();
    return deps.keys;
  };

  const run =
    (handler: (req: import('express').Request, res: import('express').Response) => Promise<void>) =>
    (req: import('express').Request, res: import('express').Response): void => {
      void handler(req, res).catch((error) => {
        if (error instanceof OmnirouteAdminValidationError) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: error.message } });
          return;
        }
        if (error instanceof SupabaseControlRepositoryError) {
          res.status(503).json({
            error: { code: 'SERVICE_UNAVAILABLE', message: 'Control plane is unavailable.' },
          });
          return;
        }
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Request failed.' } });
      });
    };

  const routeParam = (req: import('express').Request, key: string): string => {
    const value = req.params[key];
    if (typeof value !== 'string' || value.length === 0) {
      throw new OmnirouteAdminValidationError(`expected a ${key} route parameter`);
    }
    return value;
  };

  app.get('/v1/admin/control/omniroute/keys/:userId', run(async (req, res) => {
    const view = await requireKeys().getUserKeyView(routeParam(req, 'userId'));
    res.json({ key: view });
  }));

  app.put('/v1/admin/control/omniroute/keys/:userId/allowed-models', run(async (req, res) => {
    const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<string, unknown>;
    const models = body['allowedModels'];
    if (!Array.isArray(models) || !models.every((m) => typeof m === 'string')) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'expected allowedModels string array' } });
      return;
    }
    await requireKeys().setAllowedModels(routeParam(req, 'userId'), models as string[]);
    res.json({ ok: true });
  }));

  app.post('/v1/admin/control/omniroute/keys/:userId/revoke', run(async (req, res) => {
    await requireKeys().revokeUserKey(routeParam(req, 'userId'));
    res.json({ ok: true });
  }));

  app.get('/v1/admin/control/omniroute/usage', run(async (_req, res) => {
    res.json({ usage: await requireKeys().listUsage() });
  }));

  app.get('/v1/admin/control/omniroute/embeddings', run(async (_req, res) => {
    res.json(await requireKeys().getEmbeddingsSettings());
  }));

  app.put('/v1/admin/control/omniroute/embeddings', run(async (req, res) => {
    const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<string, unknown>;
    const model = body['embeddingModel'];
    if (model !== null && typeof model !== 'string') {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'expected embeddingModel string or null' } });
      return;
    }
    const settings = await requireKeys().setEmbeddingsSettings(
      model === null || model === undefined ? null : (model as string),
    );
    res.json(settings);
  }));
}
