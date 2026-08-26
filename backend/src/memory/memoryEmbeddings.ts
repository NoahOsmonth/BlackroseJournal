import { createOmnirouteInferenceExecutor } from '../inference/omnirouteInferenceExecutor';
import type { OmnirouteInferenceExecutor } from '../inference/omnirouteInferenceExecutor';

type Environment = Readonly<Record<string, string | undefined>>;

const DEFAULT_OMNIROUTE_BASE_URL = 'http://100.107.7.52:20128';

export interface MemoryEmbedderLogger {
  warn(event: string, details: unknown): void;
}

export interface SoftFailMemoryEmbedder {
  /**
   * Embeds inputs via OmniRoute, preserving input order.
   * Never rejects: any failure is logged and surfaces as one empty
   * vector per input — Hindsight/memory stays soft-fail everywhere.
   */
  embed(userId: string, input: string[]): Promise<number[][]>;
}

/**
 * Wraps an inference executor's embed() with the memory path's
 * fire-and-forget soft-fail contract: embedding failures must never
 * break a user request.
 */
export function createSoftFailMemoryEmbedder(deps: {
  executor: OmnirouteInferenceExecutor;
  logger?: MemoryEmbedderLogger;
}): SoftFailMemoryEmbedder {
  const logger = deps.logger ?? {
    warn: (event: string, details: unknown): void => console.warn(event, details),
  };
  return {
    async embed(userId, input) {
      if (input.length === 0) return [];
      try {
        return await deps.executor.embed({ userId, input });
      } catch (error) {
        logger.warn('memory_embedding_failed', {
          operation: 'embed',
          count: input.length,
          error,
        });
        return input.map(() => []);
      }
    },
  };
}

/**
 * Optional env switch for memory embeddings via OmniRoute.
 * Unset/empty OMNIROUTE_EMBEDDING_MODEL = embeddings feature disabled
 * (returns undefined; callers keep existing behavior). The manage key is
 * reused as the bearer key for server-side embedding calls.
 */
export function createOmnirouteMemoryEmbedderFromEnvironment(
  env: Environment,
  overrides: {
    baseUrl?: string;
    fetcher?: typeof fetch;
    logger?: MemoryEmbedderLogger;
  } = {},
): SoftFailMemoryEmbedder | undefined {
  const embeddingModel = env['OMNIROUTE_EMBEDDING_MODEL']?.trim();
  const manageKey = env['OMNIROUTE_MANAGE_KEY']?.trim();
  if (!embeddingModel || !manageKey) return undefined;
  const baseUrl = overrides.baseUrl
    ?? (env['OMNIROUTE_BASE_URL']?.trim() || DEFAULT_OMNIROUTE_BASE_URL);
  const executor = createOmnirouteInferenceExecutor({
    baseUrl,
    embeddingModel,
    getUserKey: async () => manageKey,
    ...(overrides.fetcher ? { fetcher: overrides.fetcher } : {}),
  });
  return createSoftFailMemoryEmbedder({
    executor,
    ...(overrides.logger ? { logger: overrides.logger } : {}),
  });
}
