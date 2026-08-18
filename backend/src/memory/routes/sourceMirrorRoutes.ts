import type { Application, Request, RequestHandler, Response } from 'express';
import type { DeploymentWriteRequest } from '../../../../shared/memory/deploymentAuthority';
import {
  MIRROR_CHUNK_LIMITS,
  parseMirrorChunk,
  type MirrorChunk,
} from '../../../../shared/memory/mirrorContracts';
import { recomputeChunkHash } from '../hashing/sourceHash';
import {
  SourceMirrorRepositoryError,
  type SourceMirrorErrorCode,
  type SourceMirrorRepository,
} from '../repositories/sourceMirrorRepository';

interface SourceMirrorRoutesDeps {
  authMiddleware: RequestHandler;
  repository: SourceMirrorRepository | null;
  authority: DeploymentWriteRequest | null;
  writesEnabled: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OWNER_KEYS = new Set(['ownerId', 'owner', 'owner_id']);
const INVALID = Symbol('invalid-route-input');

const STATUS_BY_CODE: Record<SourceMirrorErrorCode, number> = {
  MIRROR_BAD_REQUEST: 400,
  MIRROR_PAYLOAD_TOO_LARGE: 413,
  MIRROR_UNAUTHORIZED: 401,
  MIRROR_FORBIDDEN: 403,
  MIRROR_NOT_FOUND: 404,
  MIRROR_CONFLICT: 409,
  MIRROR_HASH_MISMATCH: 422,
  MIRROR_RATE_LIMITED: 429,
  MIRROR_WRITES_DISABLED: 503,
  WRITER_STALE_EPOCH: 503,
  WRITER_LEASE_MISMATCH: 503,
  WRITER_LEASE_EXPIRED: 503,
  WRITER_TOKEN_REJECTED: 503,
  WRITER_CREDENTIAL_MISMATCH: 503,
  WRITER_MODE_NOT_ACTIVE: 503,
  MIRROR_DATA_INVALID: 503,
  MIRROR_UNAVAILABLE: 503,
};

const MESSAGE_BY_CODE: Record<SourceMirrorErrorCode, string> = {
  MIRROR_BAD_REQUEST: 'Malformed mirror request.',
  MIRROR_PAYLOAD_TOO_LARGE: 'Mirror payload exceeds the byte bound.',
  MIRROR_UNAUTHORIZED: 'Mirror identity is missing, revoked, or invalid.',
  MIRROR_FORBIDDEN: 'Mirror mutation is not permitted for this owner.',
  MIRROR_NOT_FOUND: 'Mirror import manifest not found.',
  MIRROR_CONFLICT: 'Mirror import conflict; reconcile before retrying.',
  MIRROR_HASH_MISMATCH: 'Mirror hash, parity, or shape mismatch.',
  MIRROR_RATE_LIMITED: 'Mirror request rate limit reached.',
  MIRROR_WRITES_DISABLED: 'Mirror writes are disabled.',
  WRITER_STALE_EPOCH: 'Writer epoch is stale; refresh deployment binding.',
  WRITER_LEASE_MISMATCH: 'Writer lease mismatch; refresh deployment binding.',
  WRITER_LEASE_EXPIRED: 'Writer lease expired; refresh deployment binding.',
  WRITER_TOKEN_REJECTED: 'Writer lease token rejected; refresh deployment binding.',
  WRITER_CREDENTIAL_MISMATCH: 'Writer credential mismatch; refresh deployment binding.',
  WRITER_MODE_NOT_ACTIVE: 'Writer mode is not active; refresh deployment binding.',
  MIRROR_DATA_INVALID: 'Mirror response was invalid.',
  MIRROR_UNAVAILABLE: 'Mirror service unavailable.',
};

function sendError(
  res: Response,
  code: SourceMirrorErrorCode,
  retryAfterSeconds: number | null,
): void {
  if (code === 'MIRROR_RATE_LIMITED' && retryAfterSeconds !== null) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
  }
  res.status(STATUS_BY_CODE[code]).json({
    error: {
      code,
      message: MESSAGE_BY_CODE[code],
    },
  });
}

function sendRepositoryError(res: Response, error: unknown): void {
  if (error instanceof SourceMirrorRepositoryError) {
    sendError(res, error.code, error.retryAfterSeconds);
    return;
  }
  // Never echo the raw error or request payload.
  sendError(res, 'MIRROR_UNAVAILABLE', null);
}

function mirrorSubject(res: Response): { ownerId: string; sessionId: string } | null {
  const auth: unknown = res.locals.memoryAuth;
  if (!auth || typeof auth !== 'object') {
    return null;
  }
  const record = auth as Record<string, unknown>;
  if (
    typeof record.ownerId !== 'string'
    || typeof record.sessionId !== 'string'
    || record.sessionId === ''
  ) {
    return null;
  }
  return { ownerId: record.ownerId, sessionId: record.sessionId };
}

function hasOwnerField(body: unknown, query: unknown): boolean {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    if (Object.keys(body as Record<string, unknown>).some((key) => OWNER_KEYS.has(key))) {
      return true;
    }
  }
  if (query && typeof query === 'object' && !Array.isArray(query)) {
    if (Object.keys(query as Record<string, unknown>).some((key) => OWNER_KEYS.has(key))) {
      return true;
    }
  }
  return false;
}

function bodyRecord(req: Request): Record<string, unknown> {
  const body = req.body;
  return body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | typeof INVALID {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '' || value.length > maxLength) {
    return INVALID;
  }
  return value;
}

function requiredUuid(record: Record<string, unknown>, key: string): string | typeof INVALID {
  const value = requiredString(record, key, 64);
  if (value === INVALID || !UUID.test(value)) {
    return INVALID;
  }
  return value;
}

function optionalNullableUuid(
  record: Record<string, unknown>,
  key: string,
): string | null | typeof INVALID {
  if (!(key in record) || record[key] === null || record[key] === undefined) {
    return null;
  }
  if (typeof record[key] !== 'string' || !UUID.test(record[key])) {
    return INVALID;
  }
  return record[key];
}

function requiredInteger(
  record: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
): number | typeof INVALID {
  const value = record[key];
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < minimum
    || value > maximum
  ) {
    return INVALID;
  }
  return value;
}

function optionalInteger(
  record: Record<string, unknown>,
  key: string,
  minimum: number,
): number | null | typeof INVALID {
  if (!(key in record) || record[key] === null || record[key] === undefined) {
    return null;
  }
  return requiredInteger(record, key, minimum, Number.MAX_SAFE_INTEGER);
}

function timestamp(value: unknown): string | typeof INVALID {
  if (typeof value !== 'string') {
    return INVALID;
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    return INVALID;
  }
  return new Date(milliseconds).toISOString();
}

function manifestIdParam(req: Request): string | typeof INVALID {
  return requiredString({ manifestId: req.params.manifestId }, 'manifestId', 200);
}

function chunkIndexParam(req: Request): number | typeof INVALID {
  const raw = req.params.chunkIndex;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    return INVALID;
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 159) {
    return INVALID;
  }
  return parsed;
}

interface MutantDeps {
  repository: SourceMirrorRepository;
  authority: DeploymentWriteRequest;
}

function mutationDeps(res: Response, deps: SourceMirrorRoutesDeps): MutantDeps | null {
  if (!deps.writesEnabled) {
    sendError(res, 'MIRROR_WRITES_DISABLED', null);
    return null;
  }
  if (!deps.repository || !deps.authority) {
    sendError(res, 'MIRROR_UNAVAILABLE', null);
    return null;
  }
  return { repository: deps.repository, authority: deps.authority };
}

function readRepository(res: Response, deps: SourceMirrorRoutesDeps): SourceMirrorRepository | null {
  if (!deps.repository) {
    sendError(res, 'MIRROR_UNAVAILABLE', null);
    return null;
  }
  return deps.repository;
}

function authorizedSubject(res: Response): { ownerId: string; sessionId: string } | null {
  const subject = mirrorSubject(res);
  if (!subject) {
    sendError(res, 'MIRROR_UNAUTHORIZED', null);
    return null;
  }
  return subject;
}

export function registerSourceMirrorRoutes(
  app: Application,
  deps: SourceMirrorRoutesDeps,
): void {
  app.use('/v1/memory/mirror', (_req: Request, res: Response, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/v1/memory/mirror', deps.authMiddleware);

  app.post('/v1/memory/mirror/enroll', async (req: Request, res: Response) => {
    const subject = authorizedSubject(res);
    if (!subject) {
      return;
    }
    if (hasOwnerField(req.body, req.query)) {
      sendError(res, 'MIRROR_BAD_REQUEST', null);
      return;
    }
    const mutant = mutationDeps(res, deps);
    if (!mutant) {
      return;
    }
    const body = bodyRecord(req);
    const datasetId = optionalNullableUuid(body, 'datasetId');
    if (datasetId === INVALID) {
      sendError(res, 'MIRROR_BAD_REQUEST', null);
      return;
    }
    try {
      const state = await mutant.repository.enroll(
        mutant.authority,
        subject.ownerId,
        subject.sessionId,
        datasetId,
      );
      res.json({ data: state });
    } catch (error) {
      sendRepositoryError(res, error);
    }
  });

  app.post('/v1/memory/mirror/imports', async (req: Request, res: Response) => {
    const subject = authorizedSubject(res);
    if (!subject) {
      return;
    }
    if (hasOwnerField(req.body, req.query)) {
      sendError(res, 'MIRROR_BAD_REQUEST', null);
      return;
    }
    const mutant = mutationDeps(res, deps);
    if (!mutant) {
      return;
    }
    const body = bodyRecord(req);
    const manifestId = requiredString(body, 'manifestId', 200);
    const datasetId = requiredUuid(body, 'datasetId');
    const contractVersion = requiredInteger(body, 'contractVersion', 1, 32);
    const importGeneration = requiredInteger(
      body,
      'importGeneration',
      1,
      Number.MAX_SAFE_INTEGER,
    );
    const declaredChunkCount = requiredInteger(body, 'declaredChunkCount', 0, 160);
    const sourceCount = requiredInteger(body, 'sourceCount', 0, 2_560);
    const messageCount = requiredInteger(body, 'messageCount', 0, 20_000);
    const sourceHash = requiredString(body, 'sourceHash', 512);
    if (
      manifestId === INVALID
      || datasetId === INVALID
      || contractVersion === INVALID
      || importGeneration === INVALID
      || declaredChunkCount === INVALID
      || sourceCount === INVALID
      || messageCount === INVALID
      || sourceHash === INVALID
    ) {
      sendError(res, 'MIRROR_BAD_REQUEST', null);
      return;
    }
    try {
      const manifest = await mutant.repository.beginImport(
        mutant.authority,
        subject.ownerId,
        subject.sessionId,
        {
          manifestId,
          datasetId,
          contractVersion,
          importGeneration,
          declaredChunkCount,
          sourceCount,
          messageCount,
          sourceHash,
        },
      );
      res.json({ data: manifest });
    } catch (error) {
      sendRepositoryError(res, error);
    }
  });

  app.get('/v1/memory/mirror/imports/:manifestId', async (req: Request, res: Response) => {
    const subject = authorizedSubject(res);
    if (!subject) {
      return;
    }
    if (hasOwnerField(req.body, req.query)) {
      sendError(res, 'MIRROR_BAD_REQUEST', null);
      return;
    }
    const repository = readRepository(res, deps);
    if (!repository) {
      return;
    }
    const manifestId = manifestIdParam(req);
    if (manifestId === INVALID) {
      sendError(res, 'MIRROR_BAD_REQUEST', null);
      return;
    }
    try {
      const manifest = await repository.getImport(
        subject.ownerId,
        subject.sessionId,
        manifestId,
      );
      res.json({ data: manifest });
    } catch (error) {
      sendRepositoryError(res, error);
    }
  });

  app.put(
    '/v1/memory/mirror/imports/:manifestId/chunks/:chunkIndex',
    async (req: Request, res: Response) => {
      const subject = authorizedSubject(res);
      if (!subject) {
        return;
      }
      if (hasOwnerField(req.body, req.query)) {
        sendError(res, 'MIRROR_BAD_REQUEST', null);
        return;
      }
      const mutant = mutationDeps(res, deps);
      if (!mutant) {
        return;
      }
      const manifestId = manifestIdParam(req);
      const chunkIndex = chunkIndexParam(req);
      if (manifestId === INVALID || chunkIndex === INVALID) {
        sendError(res, 'MIRROR_BAD_REQUEST', null);
        return;
      }
      const body = bodyRecord(req);
      const rawChunk: unknown = body.chunk;
      if (!rawChunk || typeof rawChunk !== 'object' || Array.isArray(rawChunk)) {
        sendError(res, 'MIRROR_BAD_REQUEST', null);
        return;
      }
      const encodedBytes = new TextEncoder().encode(JSON.stringify(rawChunk)).byteLength;
      if (encodedBytes > MIRROR_CHUNK_LIMITS.maxEncodedJsonBytes) {
        sendError(res, 'MIRROR_PAYLOAD_TOO_LARGE', null);
        return;
      }
      let chunk: MirrorChunk;
      try {
        chunk = parseMirrorChunk(rawChunk);
      } catch {
        sendError(res, 'MIRROR_BAD_REQUEST', null);
        return;
      }
      if (
        chunk.manifestId !== manifestId
        || chunk.chunkIndex !== chunkIndex
      ) {
        sendError(res, 'MIRROR_BAD_REQUEST', null);
        return;
      }
      // The client-supplied hash (if any) is never trusted: recompute in Node.
      const chunkHash = recomputeChunkHash(chunk);
      try {
        const receipt = await mutant.repository.acceptChunk(
          mutant.authority,
          subject.ownerId,
          subject.sessionId,
          manifestId,
          chunkIndex,
          chunk,
          chunkHash,
        );
        res.json({ data: receipt });
      } catch (error) {
        sendRepositoryError(res, error);
      }
    },
  );

  app.post('/v1/memory/mirror/imports/:manifestId/cancel', async (req: Request, res: Response) => {
    const subject = authorizedSubject(res);
    if (!subject) {
      return;
    }
    if (hasOwnerField(req.body, req.query)) {
      sendError(res, 'MIRROR_BAD_REQUEST', null);
      return;
    }
    const mutant = mutationDeps(res, deps);
    if (!mutant) {
      return;
    }
    const manifestId = manifestIdParam(req);
    if (manifestId === INVALID) {
      sendError(res, 'MIRROR_BAD_REQUEST', null);
      return;
    }
    try {
      const manifest = await mutant.repository.cancelImport(
        mutant.authority,
        subject.ownerId,
        subject.sessionId,
        manifestId,
      );
      res.json({ data: manifest });
    } catch (error) {
      sendRepositoryError(res, error);
    }
  });

  app.post(
    '/v1/memory/mirror/imports/:manifestId/prepare-completion',
    async (req: Request, res: Response) => {
      const subject = authorizedSubject(res);
      if (!subject) {
        return;
      }
      if (hasOwnerField(req.body, req.query)) {
        sendError(res, 'MIRROR_BAD_REQUEST', null);
        return;
      }
      const mutant = mutationDeps(res, deps);
      if (!mutant) {
        return;
      }
      const manifestId = manifestIdParam(req);
      const expectedAuthorityVersion = requiredInteger(
        bodyRecord(req),
        'expectedAuthorityVersion',
        1,
        Number.MAX_SAFE_INTEGER,
      );
      if (manifestId === INVALID || expectedAuthorityVersion === INVALID) {
        sendError(res, 'MIRROR_BAD_REQUEST', null);
        return;
      }
      try {
        const permit = await mutant.repository.prepareCompletion(
          mutant.authority,
          subject.ownerId,
          subject.sessionId,
          manifestId,
          expectedAuthorityVersion,
        );
        res.json({ data: permit });
      } catch (error) {
        sendRepositoryError(res, error);
      }
    },
  );

  app.post('/v1/memory/mirror/imports/:manifestId/complete', async (req: Request, res: Response) => {
    const subject = authorizedSubject(res);
    if (!subject) {
      return;
    }
    if (hasOwnerField(req.body, req.query)) {
      sendError(res, 'MIRROR_BAD_REQUEST', null);
      return;
    }
    const mutant = mutationDeps(res, deps);
    if (!mutant) {
      return;
    }
    const manifestId = manifestIdParam(req);
    const body = bodyRecord(req);
    const permitId = requiredUuid(body, 'permitId');
    const expectedAuthorityVersion = requiredInteger(
      body,
      'expectedAuthorityVersion',
      1,
      Number.MAX_SAFE_INTEGER,
    );
    const preparedHash = requiredString(body, 'preparedHash', 512);
    const membershipHash = requiredString(body, 'membershipHash', 512);
    if (
      manifestId === INVALID
      || permitId === INVALID
      || expectedAuthorityVersion === INVALID
      || preparedHash === INVALID
      || membershipHash === INVALID
    ) {
      sendError(res, 'MIRROR_BAD_REQUEST', null);
      return;
    }
    try {
      const manifest = await mutant.repository.completeImport(
        mutant.authority,
        subject.ownerId,
        subject.sessionId,
        {
          manifestId,
          permitId,
          expectedAuthorityVersion,
          preparedHash,
          membershipHash,
        },
      );
      res.json({ data: manifest });
    } catch (error) {
      sendRepositoryError(res, error);
    }
  });

  app.post('/v1/memory/mirror/tombstones', async (req: Request, res: Response) => {
    const subject = authorizedSubject(res);
    if (!subject) {
      return;
    }
    if (hasOwnerField(req.body, req.query)) {
      sendError(res, 'MIRROR_BAD_REQUEST', null);
      return;
    }
    const mutant = mutationDeps(res, deps);
    if (!mutant) {
      return;
    }
    const body = bodyRecord(req);
    const sourceKind = requiredString(body, 'sourceKind', 64);
    const sourceId = requiredString(body, 'sourceId', 512);
    const sourceRevision = requiredInteger(body, 'sourceRevision', 1, Number.MAX_SAFE_INTEGER);
    const previousAcceptedRevision = optionalInteger(
      body,
      'previousAcceptedRevision',
      1,
    );
    const clientEventId = requiredString(body, 'clientEventId', 1024);
    const deletedAt = timestamp(body.deletedAt);
    const reasonCode = requiredString(body, 'reasonCode', 128);
    if (
      sourceKind === INVALID
      || sourceId === INVALID
      || sourceRevision === INVALID
      || previousAcceptedRevision === INVALID
      || clientEventId === INVALID
      || deletedAt === INVALID
      || reasonCode === INVALID
    ) {
      sendError(res, 'MIRROR_BAD_REQUEST', null);
      return;
    }
    try {
      const record = await mutant.repository.applyTombstone(
        mutant.authority,
        subject.ownerId,
        subject.sessionId,
        {
          sourceKind,
          sourceId,
          sourceRevision,
          previousAcceptedRevision,
          clientEventId,
          deletedAt,
          reasonCode,
        },
      );
      res.json({ data: record });
    } catch (error) {
      sendRepositoryError(res, error);
    }
  });

  app.get('/v1/memory/mirror/parity', async (_req: Request, res: Response) => {
    const subject = authorizedSubject(res);
    if (!subject) {
      return;
    }
    const repository = readRepository(res, deps);
    if (!repository) {
      return;
    }
    try {
      const parity = await repository.getParity(subject.ownerId, subject.sessionId);
      res.json({ data: parity });
    } catch (error) {
      sendRepositoryError(res, error);
    }
  });
}
