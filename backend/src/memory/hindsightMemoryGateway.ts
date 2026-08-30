import { createMemoryBankDeriver } from './memoryBank';
import type { MemoryGatewayConfig } from './memoryConfig';
import { redactSensitive } from '../security/redaction';
import { createHash } from 'node:crypto';
import type {
  MemoryRecallRequest, MemoryRebuildRequest, MemoryReflectRequest, MemoryRetainRequest,
  MemoryMetadata, MemoryRecallResult,
} from '../../../packages/ai-control-plane-contracts/src';

export interface HindsightMemoryGateway {
  retain(userId: string, body: unknown): Promise<unknown>;
  recall(userId: string, body: unknown): Promise<unknown>;
  reflect(userId: string, body: unknown): Promise<unknown>;
  rebuild(userId: string, body: unknown): Promise<unknown>;
  clear(userId: string): Promise<unknown>;
}

export interface HindsightMemoryGatewayDependencies {
  fetcher?: typeof fetch;
  logger?: MemoryGatewayLogger;
}

export interface MemoryGatewayLogger {
  warn(event: string, details: unknown): void;
}

export class MemoryGatewayUnavailableError extends Error {
  constructor() {
    super('Memory service is unavailable.');
    this.name = 'MemoryGatewayUnavailableError';
  }
}

export class MemoryGatewayTimeoutError extends Error {
  constructor() {
    super('Memory service timed out.');
    this.name = 'MemoryGatewayTimeoutError';
  }
}

export class MemoryGatewayResponseError extends Error {
  constructor() {
    super('Memory service returned an invalid response.');
    this.name = 'MemoryGatewayResponseError';
  }
}

async function readBoundedResponse(response: Response, maximumBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        throw new MemoryGatewayResponseError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size).toString('utf8');
}

export function createHindsightMemoryGateway(
  config: MemoryGatewayConfig,
  dependencies: HindsightMemoryGatewayDependencies = {},
): HindsightMemoryGateway {
  const fetcher = dependencies.fetcher ?? fetch;
  const logger = dependencies.logger ?? {
    warn: (event: string, details: unknown): void => console.warn(event, details),
  };
  const deriveBank = createMemoryBankDeriver({
    key: config.bankKey,
    version: config.bankKeyVersion,
  });

  const request = async (
    userId: string,
    operation: string,
    suffix: string,
    method: 'POST' | 'DELETE',
    body?: unknown,
  ): Promise<unknown> => {
    const bank = deriveBank(userId);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      const response = await fetcher(
        `${config.baseUrl}/v1/default/banks/${encodeURIComponent(bank)}${suffix}`,
        {
          method,
          headers: {
            accept: 'application/json',
            ...(body === undefined ? {} : { 'content-type': 'application/json' }),
            ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          redirect: 'error',
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new MemoryGatewayResponseError();
      const text = await readBoundedResponse(response, config.maxResponseBytes);
      let value: unknown = { ok: true };
      if (text) {
        try {
          value = JSON.parse(text) as unknown;
        } catch {
          throw new MemoryGatewayResponseError();
        }
      }
      return sanitizeMemoryResponse(value, [userId, bank]);
    } catch (error) {
      const normalizedError = controller.signal.aborted
        ? new MemoryGatewayTimeoutError()
        : error instanceof MemoryGatewayResponseError
          ? error
          : new MemoryGatewayUnavailableError();
      logger.warn('memory_gateway_request_failed', redactSensitive({ operation, error }, [
        userId,
        bank,
        config.apiKey ?? '',
      ]));
      throw normalizedError;
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    async retain(userId, body) {
      const item = body as MemoryRetainRequest;
      await request(userId, 'retain', '/memories', 'POST', {
        items: [toHindsightItem(item)],
      });
      return { retained: true };
    },
    async recall(userId, body) {
      const input = body as MemoryRecallRequest;
      const raw = await request(userId, 'recall', '/memories/recall', 'POST', {
        query: input.query, limit: input.limit ?? 6,
      });
      return { results: normalizeRecallResults(raw) };
    },
    async reflect(userId, body) {
      const input = body as MemoryReflectRequest;
      const raw = await request(userId, 'reflect', '/reflect', 'POST', { query: input.query });
      return { reflection: normalizeReflection(raw) };
    },
    async rebuild(userId, body) {
      const input = body as MemoryRebuildRequest;
      await request(userId, 'rebuild_clear', '/memories', 'DELETE');
      await request(userId, 'rebuild_retain', '/memories', 'POST', {
        items: input.items.map((item) => toHindsightItem(item)),
      });
      return { accepted: input.items.length };
    },
    async clear(userId) {
      await request(userId, 'clear', '/memories', 'DELETE');
      return { cleared: true };
    },
  };
}

function toHindsightItem(item: MemoryRetainRequest): Record<string, string> {
  const createdAt = item.createdAt ?? new Date().toISOString();
  const documentId = item.documentId ?? `memory:${createHash('sha256')
    .update(`${createdAt}\0${item.content}`, 'utf8').digest('hex')}`;
  return { content: item.content, timestamp: createdAt, document_id: documentId };
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function sourceMetadata(documentId: string, writtenAt?: string): MemoryMetadata | undefined {
  const match = /^(journal_entry|intention_checkin):(.+)$/.exec(documentId);
  if (!match && !writtenAt) return undefined;
  return {
    ...(match ? { source: match[1] === 'journal_entry' ? 'journal' as const : 'check_in' as const,
      sourceId: match[2], completed: true } : {}),
    ...(writtenAt ? { writtenAt } : {}),
  };
}

function normalizeRecallResults(value: unknown): MemoryRecallResult[] {
  const container = record(value);
  const units = Array.isArray(value) ? value
    : Array.isArray(container.units) ? container.units
      : Array.isArray(container.results) ? container.results : [];
  return units.flatMap((unit): MemoryRecallResult[] => {
    const item = record(unit);
    const content = typeof item.content === 'string' ? item.content
      : typeof item.text === 'string' ? item.text : '';
    if (!content) return [];
    const scores = record(item.scores);
    const rawScore = typeof item.similarity === 'number' ? item.similarity
      : typeof item.score === 'number' ? item.score
        : typeof scores.final === 'number' ? scores.final : 0;
    const score = Math.max(0, Math.min(1, Number.isFinite(rawScore) ? rawScore : 0));
    const documentId = typeof item.document_id === 'string' ? item.document_id
      : typeof item.documentId === 'string' ? item.documentId : '';
    const writtenAt = typeof item.occurred_start === 'string' ? item.occurred_start
      : typeof item.timestamp === 'string' ? item.timestamp : undefined;
    const metadata = sourceMetadata(documentId, writtenAt);
    return [{ documentId, content, score, ...(metadata ? { metadata } : {}) }];
  });
}

function normalizeReflection(value: unknown): string {
  if (typeof value === 'string') return value;
  const item = record(value);
  if (typeof item.reflection === 'string') return item.reflection;
  return typeof item.text === 'string' ? item.text : '';
}

function identifierTokens(value: string): string[] {
  return value
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function isInternalIdentityKey(key: string): boolean {
  const tokens = identifierTokens(key);
  return tokens.includes('bank') || (tokens.includes('user') && tokens.includes('id'));
}

function redactOpaqueString(value: string, opaqueValues: readonly string[]): string {
  return opaqueValues.reduce(
    (output, opaque) => opaque ? output.split(opaque).join('[REDACTED]') : output,
    value,
  );
}

function sanitizeMemoryResponse(value: unknown, opaqueValues: readonly string[]): unknown {
  if (typeof value === 'string') return redactOpaqueString(value, opaqueValues);
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMemoryResponse(item, opaqueValues));
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isInternalIdentityKey(key))
      .map(([key, item]) => [key, sanitizeMemoryResponse(item, opaqueValues)]),
  );
}
