import type { OmniroutePublishedModelsStore, PublishedModelRow } from './omnirouteAdminService';

export interface OmniroutePublishedModelsStoreOptions {
  restUrl: string;
  secretKey: string;
  fetcher?: typeof fetch;
}

interface RestRequest {
  method?: string;
  query?: Readonly<Record<string, string>>;
  body?: unknown;
  prefer?: string;
}

/**
 * Supabase REST store for `control.admin_published_models`
 * (model_id text pk, label text). Additive table — see migration
 * 20260826093000_admin_published_models.sql.
 */
export function createOmniroutePublishedModelsStore(
  options: OmniroutePublishedModelsStoreOptions,
): OmniroutePublishedModelsStore {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.restUrl.replace(/\/+$/, '');

  const request = async (path: string, rest: RestRequest = {}): Promise<unknown> => {
    const url = new URL(`${baseUrl}/${path.replace(/^\/+/, '')}`);
    Object.entries(rest.query ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    timer.unref();
    try {
      const response = await fetcher(url, {
        method: rest.method ?? 'GET',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          apikey: options.secretKey,
          authorization: `Bearer ${options.secretKey}`,
          'accept-profile': 'control',
          ...(rest.method && rest.method !== 'GET' ? { 'content-profile': 'control' } : {}),
          ...(rest.body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(rest.prefer ? { prefer: rest.prefer } : {}),
        },
        ...(rest.body !== undefined ? { body: JSON.stringify(rest.body) } : {}),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`admin_published_models request failed (${response.status})`);
      if (!text) return [];
      return JSON.parse(text) as unknown;
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    async list(): Promise<PublishedModelRow[]> {
      const rows = await request('admin_published_models', {
        query: { select: '*', order: 'model_id.asc' },
      });
      if (!Array.isArray(rows)) throw new Error('Unexpected admin_published_models payload.');
      return rows.map((row) => {
        const record = row as Record<string, unknown>;
        if (typeof record['model_id'] !== 'string' || typeof record['label'] !== 'string') {
          throw new Error('Unexpected admin_published_models row.');
        }
        return { modelId: record['model_id'], label: record['label'] };
      });
    },

    async upsert(rows: PublishedModelRow[]): Promise<void> {
      if (rows.length === 0) return;
      await request('admin_published_models', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: rows.map((row) => ({ model_id: row.modelId, label: row.label })),
      });
    },

    async remove(modelIds: string[]): Promise<void> {
      if (modelIds.length === 0) return;
      await request('admin_published_models', {
        method: 'DELETE',
        query: { model_id: `in.(${modelIds.join(',')})` },
      });
    },
  };
}
