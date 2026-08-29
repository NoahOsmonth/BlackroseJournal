import type { Application, Request, Response } from 'express';
import {
  ContractValidationError,
  parseUpdateModelPreferenceRequest,
} from '../../../packages/ai-control-plane-contracts/src';
import {
  ControlPlaneConflictError,
  ControlPlaneNotFoundError,
  ControlPlaneValidationError,
  type ControlPlaneService,
} from '../control/controlPlaneService';
import {
  SupabaseControlRepositoryConflictError,
  SupabaseControlRepositoryError,
} from '../control/supabaseControlPlaneRepository';

export type ControlPlaneRouteService = Pick<
  ControlPlaneService,
  | 'getCatalog'
  | 'getPreference'
  | 'updatePreference'
>;

function principalUserId(res: Response): string | null {
  const principal: unknown = res.locals.authenticatedPrincipal;
  if (typeof principal !== 'object' || principal === null) return null;
  const userId = (principal as { userId?: unknown }).userId;
  return typeof userId === 'string' && userId.length > 0 ? userId : null;
}

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ContractValidationError('request', 'expected an object');
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !keys.includes(key))) {
    throw new ContractValidationError('request', 'contains an unknown field');
  }
  return record;
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof ContractValidationError || error instanceof ControlPlaneValidationError) {
    res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Request is invalid.' } });
    return;
  }
  if (error instanceof ControlPlaneConflictError) {
    res.status(409).json({
      code: 'revision_conflict',
      message: error.message,
      currentRevision: error.currentRevision,
      currentState: error.currentState,
    });
    return;
  }
  if (error instanceof SupabaseControlRepositoryConflictError) {
    res.status(409).json({
      code: 'revision_conflict',
      message: 'The resource changed before this mutation was applied.',
      currentRevision: 0,
      currentState: {},
    });
    return;
  }
  if (error instanceof ControlPlaneNotFoundError) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: error.message } });
    return;
  }
  if (error instanceof SupabaseControlRepositoryError) {
    res.status(503).json({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Control plane is unavailable.' },
    });
    return;
  }
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Request failed.' } });
}

function run(
  handler: (req: Request, res: Response) => Promise<void>,
) {
  return (req: Request, res: Response): void => {
    void handler(req, res).catch((error) => sendError(res, error));
  };
}

function requireUser(res: Response): string {
  const userId = principalUserId(res);
  if (!userId) throw new SupabaseControlRepositoryError();
  return userId;
}

export function registerControlPlaneRoutes(
  app: Application,
  service?: ControlPlaneRouteService,
): void {
  const requireService = (): ControlPlaneRouteService => {
    if (!service) throw new SupabaseControlRepositoryError();
    return service;
  };

  app.get('/v1/ai/catalog', run(async (_req, res) => {
    requireUser(res);
    res.json(await requireService().getCatalog());
  }));

  app.get('/v1/ai/preferences/model', run(async (_req, res) => {
    const preference = await requireService().getPreference(requireUser(res));
    res.json(preference ?? { selectedModelId: null, revision: 0, updatedAt: '' });
  }));

  app.put('/v1/ai/preferences/model', run(async (req, res) => {
    const input = parseUpdateModelPreferenceRequest(req.body);
    res.json(await requireService().updatePreference(requireUser(res), input));
  }));
}
