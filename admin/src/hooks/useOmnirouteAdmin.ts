import { useCallback, useEffect, useState } from 'react';
import { AdminApiError } from '../services/adminApi';
import type {
  OmnirouteAdminClient,
  OmnirouteModel,
  OmnirouteProvider,
  OmniroutePublishedModel,
} from '../services/omnirouteAdminApi';

export interface OmnirouteAdminState {
  loading: boolean;
  busyAction: string | null;
  error: string | null;
  providers: OmnirouteProvider[];
  models: OmnirouteModel[];
  published: OmniroutePublishedModel[];
}

function message(error: unknown): string {
  if (error instanceof AdminApiError) {
    if (error.status === 401) return 'Your session expired. Sign in again.';
    if (error.status === 403) return 'This account is not authorized as an administrator.';
    if (error.status === 502 || error.status === 504) return 'OmniRoute is unreachable right now.';
    return error.message;
  }
  return 'The OmniRoute request failed. No changes were applied.';
}

/**
 * UI→hooks→services: the panels never touch the client directly. All
 * mutations go through here so busy/error state stays consistent.
 */
export function useOmnirouteAdmin(client: OmnirouteAdminClient | null, enabled: boolean) {
  const [state, setState] = useState<OmnirouteAdminState>({
    loading: enabled,
    busyAction: null,
    error: null,
    providers: [],
    models: [],
    published: [],
  });

  const patch = useCallback((changes: Partial<OmnirouteAdminState>) => {
    setState((previous) => ({ ...previous, ...changes }));
  }, []);

  const fail = useCallback((error: unknown) => {
    patch({ busyAction: null, error: message(error) });
  }, [patch]);

  const refresh = useCallback(async () => {
    if (!client || !enabled) {
      patch({ loading: false });
      return;
    }
    patch({ loading: true, error: null });
    try {
      const [providers, catalog] = await Promise.all([
        client.listProviders(),
        client.listModels(),
      ]);
      patch({
        loading: false,
        providers,
        models: catalog.models,
        published: catalog.published,
      });
    } catch (error) {
      fail(error);
    }
  }, [client, enabled, fail, patch]);

  useEffect(() => { void refresh(); }, [refresh]);

  const testProvider = useCallback(async (id: string): Promise<boolean> => {
    if (!client) return false;
    patch({ busyAction: `test-${id}`, error: null });
    try {
      const result = await client.testProvider(id);
      patch({ busyAction: null });
      return result.valid;
    } catch (error) {
      fail(error);
      return false;
    }
  }, [client, fail, patch]);

  /**
   * Disconnect-only: removes the provider's published models from the
   * allowlist. The typed confirmation phrase is built here and enforced
   * again server-side.
   */
  const disconnectProvider = useCallback(async (providerName: string): Promise<boolean> => {
    if (!client) return false;
    patch({ busyAction: `disconnect-${providerName}`, error: null });
    try {
      await client.disconnectProvider(providerName);
      await refresh();
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }, [client, fail, patch, refresh]);

  const updatePublishedModels = useCallback(async (
    upserts: OmniroutePublishedModel[],
    removes: string[],
  ): Promise<boolean> => {
    if (!client) return false;
    patch({ busyAction: 'published-models', error: null });
    try {
      const result = await client.updatePublishedModels({ upserts, removes });
      patch({ busyAction: null, published: result.published });
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }, [client, fail, patch]);

  return { state, refresh, testProvider, disconnectProvider, updatePublishedModels };
}
