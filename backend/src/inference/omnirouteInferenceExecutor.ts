import { OmnirouteRequestError } from '../control/omnirouteAdapter';

export interface OmnirouteChatRequest {
  userId: string;
  model: string;
  messages: unknown[];
}

export interface OmnirouteEmbedRequest {
  userId: string;
  input: string[];
}

export interface OmnirouteInferenceExecutorDeps {
  baseUrl: string;
  getUserKey: (userId: string) => Promise<string>;
  embeddingModel?: string | null;
  fetcher?: typeof fetch;
}

export interface OmnirouteInferenceExecutor {
  chat(req: OmnirouteChatRequest, signal?: AbortSignal): Promise<Response>;
  embed(req: OmnirouteEmbedRequest): Promise<number[][]>;
}

function trimBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

/**
 * Thin fetch wrapper for the OmniRoute data-plane (inference) endpoints.
 * No retry logic — OmniRoute owns resilience and circuit-breaking.
 * `chat` returns the raw upstream Response so SSE streaming passes through untouched.
 */
export function createOmnirouteInferenceExecutor(
  deps: OmnirouteInferenceExecutorDeps,
): OmnirouteInferenceExecutor {
  const doFetch = deps.fetcher ?? fetch;
  const base = trimBase(deps.baseUrl);

  return {
    async chat(req, signal?) {
      const key = await deps.getUserKey(req.userId);
      return doFetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: req.model, messages: req.messages }),
        ...(signal ? { signal } : {}),
      });
    },

    async embed(req) {
      const model = deps.embeddingModel?.trim();
      if (!model) throw new Error('OmniRoute embedding model is not configured.');
      const key = await deps.getUserKey(req.userId);
      let res: Response;
      try {
        res = await doFetch(`${base}/v1/embeddings`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model, input: req.input }),
        });
      } catch {
        throw new OmnirouteRequestError(0, null, 'OmniRoute unreachable');
      }
      if (!res.ok) {
        throw new OmnirouteRequestError(res.status, await res.json().catch(() => null));
      }
      const body = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
      if (!Array.isArray(body.data)) {
        throw new OmnirouteRequestError(res.status, body, 'OmniRoute embeddings response is malformed.');
      }
      return body.data.map((item) => {
        if (!Array.isArray(item.embedding)) {
          throw new OmnirouteRequestError(res.status, body, 'OmniRoute embeddings response is malformed.');
        }
        return item.embedding;
      });
    },
  };
}
