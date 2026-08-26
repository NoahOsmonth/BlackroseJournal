import { useCallback, useEffect, useState } from 'react';
import { AdminApiError } from '../services/adminApi';
import type {
  OmnirouteAdminClient,
  OmnirouteEmbeddingsSettings,
  OmnirouteModel,
  OmnirouteProvider,
  OmniroutePublishedModel,
  OmnirouteUsageRow,
  OmnirouteUserKeyView,
} from '../services/omnirouteAdminApi';

export interface OmnirouteAdminState {
  loading: boolean;
  busyAction: string | null;
  error: string | null;
  providers: OmnirouteProvider[];
  models: OmnirouteModel[];
  published: OmniroutePublishedModel[];
  userKeys: OmnirouteUserKeyView[];
  usage: OmnirouteUsageRow[];
  embeddings: OmnirouteEmbeddingsSettings | null;
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
    userKeys: [],
    usage: [],
    embeddings: null,
  });

  const patch = useCallback((changes: Partial<OmnirouteAdminState> | ((previous: OmnirouteAdminState) => Partial<OmnirouteAdminState>)) => {
    setState((previous) => ({ ...previous, ...(typeof changes === 'function' ? changes(previous) : changes) }));
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

  /** Task 7 — looks up a user's masked key and appends it to the panel list. */
  const lookupUserKey = useCallback(async (userId: string): Promise<boolean> => {
    if (!client) return false;
    patch({ busyAction: 'lookup', error: null });
    try {
      const key = await client.getUserKey(userId);
      patch((previous) => ({
        busyAction: null,
        userKeys: key
          ? [...previous.userKeys.filter((k) => k.userId !== userId), key]
          : previous.userKeys,
        error: key ? null : `No active key found for ${userId}.`,
      }));
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }, [client, fail, patch]);

  const revokeUserKey = useCallback(async (userId: string): Promise<boolean> => {
    if (!client) return false;
    patch({ busyAction: `revoke-${userId}`, error: null });
    try {
      await client.revokeUserKey(userId);
      patch((previous) => ({
        busyAction: null,
        userKeys: previous.userKeys.filter((k) => k.userId !== userId),
      }));
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }, [client, fail, patch]);

  const updateAllowedModels = useCallback(async (
    userId: string,
    allowedModels: string[],
  ): Promise<boolean> => {
    if (!client) return false;
    patch({ busyAction: `models-${userId}`, error: null });
    try {
      await client.setKeyAllowedModels(userId, allowedModels);
      patch((previous) => ({
        busyAction: null,
        userKeys: previous.userKeys.map((k) =>
          k.userId === userId ? { ...k, allowedModels } : k),
      }));
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }, [client, fail, patch]);

  const setEmbeddingsModel = useCallback(async (model: string | null): Promise<boolean> => {
    if (!client) return false;
    patch({ busyAction: 'embeddings', error: null });
    try {
      const settings = await client.setEmbeddingsSettings(model);
      patch({ busyAction: null, embeddings: settings });
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }, [client, fail, patch]);

  // Task 7 — usage + embeddings load alongside the main refresh.
  useEffect(() => {
    if (!client || !enabled) return;
    void Promise.all([client.listUsage(), client.getEmbeddingsSettings()])
      .then(([usage, embeddings]) => patch({ usage, embeddings }))
      .catch(() => undefined); // soft-fail: panels show empty states
  }, [client, enabled, patch]);

  return {
    state,
    refresh,
    testProvider,
    disconnectProvider,
    updatePublishedModels,
    lookupUserKey,
    revokeUserKey,
    updateAllowedModels,
    setEmbeddingsModel,
  };
}
