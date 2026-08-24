import type { Application, Request, Response } from 'express';
import {
  ContractValidationError,
  parseUpdateModelPreferenceRequest,
} from '../../../packages/ai-control-plane-contracts/src';
import {
  parseArchiveCatalogModelRequest,
  parseArchiveProviderRequest,
  parseCreateProviderRequest,
  parseDiscoverProviderRequest,
  parsePublishCatalogModelRequest,
  parseRotateProviderCredentialRequest,
  parseUpdateProviderRequest,
  parseUpdateRuntimeSettingsRequest,
} from '../../../packages/ai-control-plane-contracts/src/admin';
import {
  ControlPlaneConflictError,
  ControlPlaneNotFoundError,
  ControlPlaneValidationError,
  type ControlPlaneService,
} from '../control/controlPlaneService';
import { ProviderDiscoveryError } from '../control/providerDiscovery';
import {
  SupabaseControlRepositoryConflictError,
  SupabaseControlRepositoryError,
} from '../control/supabaseControlPlaneRepository';
import type { FlashRouteInput } from '../control/controlPlaneTypes';

export type ControlPlaneRouteService = Pick<
  ControlPlaneService,
  | 'getCatalog'
  | 'getPreference'
  | 'updatePreference'
  | 'listProviders'
  | 'getProvider'
  | 'getProviderHealth'
  | 'createProvider'
  | 'updateProvider'
  | 'archiveProvider'
  | 'rotateCredential'
  | 'rekeyProviderCredential'
  | 'discoverProvider'
  | 'listProviderModels'
  | 'archiveProviderModel'
  | 'publishCatalogModel'
  | 'archiveCatalogModel'
  | 'createFlashRoute'
  | 'getRuntimeSettings'
  | 'updateRuntimeSettings'
  | 'listAuditEvents'
>;

class ControlPlaneRouteAuthorizationError extends Error {}

function principalUserId(res: Response): string | null {
  const principal: unknown = res.locals.authenticatedPrincipal;
  if (typeof principal !== 'object' || principal === null) return null;
  const userId = (principal as { userId?: unknown }).userId;
  return typeof userId === 'string' && userId.length > 0 ? userId : null;
}

function adminActor(res: Response, write: boolean): string | null {
  const principal: unknown = res.locals.adminPrincipal;
  if (typeof principal !== 'object' || principal === null) return null;
  const record = principal as { userId?: unknown; role?: unknown };
  if (typeof record.userId !== 'string' || record.userId.length === 0) return null;
  if (write && record.role === 'auditor') return null;
  return record.userId;
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isInteger(parsed) || parsed < 1) {
    throw new ContractValidationError(field, 'expected a positive integer');
  }
  return parsed;
}

function routeParam(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new ContractValidationError(key, 'expected a route parameter');
  }
  return value;
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

function parseFlashRoute(value: unknown): FlashRouteInput {
  const row = exactRecord(value, [
    'expectedModelRevision', 'maxInputBytes', 'maxOutputTokens', 'requestTimeoutMs', 'priority',
  ]);
  return {
    expectedModelRevision: positiveInteger(row.expectedModelRevision, 'expectedModelRevision'),
    maxInputBytes: positiveInteger(row.maxInputBytes, 'maxInputBytes'),
    maxOutputTokens: positiveInteger(row.maxOutputTokens, 'maxOutputTokens'),
    requestTimeoutMs: positiveInteger(row.requestTimeoutMs, 'requestTimeoutMs'),
    ...(row.priority === undefined ? {} : { priority: positiveInteger(row.priority, 'priority') }),
  };
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof ControlPlaneRouteAuthorizationError) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Administrative access denied.' } });
    return;
  }
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
  if (error instanceof ProviderDiscoveryError) {
    res.status(502).json({ error: { code: 'BAD_GATEWAY', message: error.message } });
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

function requireAdminActor(res: Response, write = false): string {
  const actor = adminActor(res, write);
  if (!actor) throw new ControlPlaneRouteAuthorizationError();
  return actor;
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

  app.get('/v1/admin/providers', run(async (_req, res) => {
    requireAdminActor(res);
    res.json({ providers: await requireService().listProviders() });
  }));

  app.get('/v1/admin/providers/:id', run(async (req, res) => {
    requireAdminActor(res);
    const provider = await requireService().getProvider(routeParam(req, 'id'));
    if (!provider) throw new ControlPlaneNotFoundError('Provider');
    res.json(provider);
  }));

  app.get('/v1/admin/providers/:id/health', run(async (req, res) => {
    requireAdminActor(res);
    res.json(await requireService().getProviderHealth(routeParam(req, 'id')));
  }));

  app.post('/v1/admin/providers', run(async (req, res) => {
    const actor = requireAdminActor(res, true);
    const created = await requireService().createProvider(actor, parseCreateProviderRequest(req.body));
    res.status(201).json(created);
  }));

  app.patch('/v1/admin/providers/:id', run(async (req, res) => {
    const actor = requireAdminActor(res, true);
    res.json(await requireService().updateProvider(
      actor,
      routeParam(req, 'id'),
      parseUpdateProviderRequest(req.body),
    ));
  }));

  app.post('/v1/admin/providers/:id/archive', run(async (req, res) => {
    const actor = requireAdminActor(res, true);
    res.json(await requireService().archiveProvider(
      actor,
      routeParam(req, 'id'),
      parseArchiveProviderRequest(req.body),
    ));
  }));

  app.put('/v1/admin/providers/:id/credential', run(async (req, res) => {
    const actor = requireAdminActor(res, true);
    res.json(await requireService().rotateCredential(
      actor,
      routeParam(req, 'id'),
      parseRotateProviderCredentialRequest(req.body),
    ));
  }));

  app.post('/v1/admin/providers/:id/credential/rekey', run(async (req, res) => {
    const actor = requireAdminActor(res, true);
    const row = exactRecord(req.body, ['expectedRevision']);
    res.json(await requireService().rekeyProviderCredential(
      actor,
      routeParam(req, 'id'),
      positiveInteger(row.expectedRevision, 'expectedRevision'),
    ));
  }));

  app.post('/v1/admin/providers/:id/discover', run(async (req, res) => {
    const actor = requireAdminActor(res, true);
    const input = parseDiscoverProviderRequest(req.body);
    res.json(await requireService().discoverProvider(
      actor,
      routeParam(req, 'id'),
      input.expectedRevision,
    ));
  }));

  app.get('/v1/admin/providers/:id/models', run(async (req, res) => {
    requireAdminActor(res);
    res.json({ models: await requireService().listProviderModels(routeParam(req, 'id')) });
  }));

  app.post('/v1/admin/providers/:providerId/models/:modelId/publish', run(async (req, res) => {
    const actor = requireAdminActor(res, true);
    const input = parsePublishCatalogModelRequest(req.body);
    if (input.providerModelId !== routeParam(req, 'modelId') || input.purpose !== 'chat') {
      throw new ContractValidationError('publish', 'provider model or purpose is invalid');
    }
    const catalogRevision = positiveInteger(
      req.query.expectedCatalogRevision,
      'expectedCatalogRevision',
    );
    res.json(await requireService().publishCatalogModel(
      actor,
      routeParam(req, 'providerId'),
      input,
      catalogRevision,
    ));
  }));

  app.post('/v1/admin/catalog/:id/archive', run(async (req, res) => {
    const actor = requireAdminActor(res, true);
    res.json(await requireService().archiveCatalogModel(
      actor,
      routeParam(req, 'id'),
      parseArchiveCatalogModelRequest(req.body),
    ));
  }));

  app.post('/v1/admin/provider-models/:id/archive', run(async (req, res) => {
    const actor = requireAdminActor(res, true);
    const row = exactRecord(req.body, ['expectedRevision']);
    res.json(await requireService().archiveProviderModel(
      actor,
      routeParam(req, 'id'),
      positiveInteger(row.expectedRevision, 'expectedRevision'),
    ));
  }));

  app.post('/v1/admin/provider-models/:id/routes/flash', run(async (req, res) => {
    const actor = requireAdminActor(res, true);
    const route = await requireService().createFlashRoute(
      actor,
      routeParam(req, 'id'),
      parseFlashRoute(req.body),
    );
    res.status(201).json(route);
  }));

  app.get('/v1/admin/runtime', run(async (_req, res) => {
    requireAdminActor(res);
    res.json(await requireService().getRuntimeSettings());
  }));

  app.patch('/v1/admin/runtime', run(async (req, res) => {
    const actor = requireAdminActor(res, true);
    res.json(await requireService().updateRuntimeSettings(
      actor,
      parseUpdateRuntimeSettingsRequest(req.body),
    ));
  }));

  app.get('/v1/admin/audit', run(async (req, res) => {
    requireAdminActor(res);
    const limit = req.query.limit === undefined ? 100 : positiveInteger(req.query.limit, 'limit');
    res.json({ events: await requireService().listAuditEvents(limit) });
  }));
}
