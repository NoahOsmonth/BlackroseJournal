import { useCallback, useEffect, useReducer } from 'react';
import { AdminApiError, AdminControlPlaneClient, RevisionConflictError } from '../services/adminApi';
import type {
  CreateProviderRequest,
  FlashRouteInput,
  ProviderCredentialInput,
  ProviderModelRecord,
  PublishCatalogModelRequest,
  UpdateProviderRequest,
  UpdateRuntimeSettingsRequest,
} from '../services/adminTypes';
import { adminConsoleReducer, createInitialAdminConsoleState } from './adminConsoleState';

export function useAdminConsole(client: AdminControlPlaneClient) {
  const [state, dispatch] = useReducer(adminConsoleReducer, undefined, createInitialAdminConsoleState);

  const fail = useCallback((error: unknown) => {
    if (error instanceof RevisionConflictError) {
      dispatch({ type: 'revisionConflict', message: error.message,
        currentRevision: error.currentRevision });
      return;
    }
    const message = error instanceof AdminApiError && error.status === 403
      ? 'This account is signed in but is not authorized as an administrator.'
      : error instanceof AdminApiError && error.status === 401
        ? 'Your session expired. Sign in again.'
        : 'The control plane request failed. No changes were applied.';
    dispatch({ type: 'error', message });
  }, []);

  const loadDashboard = useCallback(async () => {
    dispatch({ type: 'loading', value: true });
    try {
      const [providers, catalog, runtime, audit] = await Promise.all([
        client.listProviders(), client.getCatalog(), client.getRuntime(), client.listAudit(),
      ]);
      dispatch({ type: 'dashboardLoaded', providers, catalog, runtime, audit });
    } catch (error) {
      fail(error);
    }
  }, [client, fail]);

  const selectProvider = useCallback(async (id: string) => {
    dispatch({ type: 'busy', action: 'provider-load' });
    try {
      const [provider, models, health] = await Promise.all([
        client.getProvider(id), client.listProviderModels(id), client.getProviderHealth(id),
      ]);
      dispatch({ type: 'providerLoaded', provider, models, health });
      dispatch({ type: 'busy', action: null });
    } catch (error) { fail(error); }
  }, [client, fail]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const createProvider = useCallback(async (input: CreateProviderRequest) => {
    dispatch({ type: 'busy', action: 'provider-save' });
    try {
      dispatch({ type: 'providerSaved', provider: await client.createProvider(input) });
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }, [client, fail]);

  const updateProvider = useCallback(async (id: string, input: UpdateProviderRequest) => {
    dispatch({ type: 'busy', action: 'provider-save' });
    try { dispatch({ type: 'providerSaved', provider: await client.updateProvider(id, input) }); }
    catch (error) { fail(error); }
  }, [client, fail]);

  const archiveProvider = useCallback(async () => {
    if (!state.selectedProvider) return;
    dispatch({ type: 'busy', action: 'provider-archive' });
    try {
      dispatch({ type: 'providerSaved', provider: await client.archiveProvider(
        state.selectedProvider.id, state.selectedProvider.revision,
      ) });
      await loadDashboard();
    } catch (error) { fail(error); }
  }, [client, fail, loadDashboard, state.selectedProvider]);

  const replaceCredential = useCallback(async (credential: ProviderCredentialInput) => {
    if (!state.selectedProvider) return false;
    dispatch({ type: 'busy', action: 'credential-save' });
    try {
      const provider = await client.replaceCredential(
        state.selectedProvider.id, state.selectedProvider.revision, credential,
      );
      dispatch({ type: 'credentialSaved', provider });
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }, [client, fail, state.selectedProvider]);

  const discover = useCallback(async () => {
    if (!state.selectedProvider) return;
    dispatch({ type: 'busy', action: 'discover' });
    try {
      await client.discoverProvider(state.selectedProvider.id, state.selectedProvider.revision);
      const [provider, models] = await Promise.all([
        client.getProvider(state.selectedProvider.id),
        client.listProviderModels(state.selectedProvider.id),
      ]);
      dispatch({ type: 'providerSaved', provider });
      dispatch({ type: 'inventoryLoaded', models });
    } catch (error) { fail(error); }
  }, [client, fail, state.selectedProvider]);

  const publish = useCallback(async (
    model: ProviderModelRecord,
    input: Omit<PublishCatalogModelRequest, 'providerModelId' | 'expectedRevision' | 'purpose'>,
  ) => {
    if (!state.selectedProvider) return;
    dispatch({ type: 'busy', action: `publish-${model.id}` });
    try {
      await client.publishModel(state.selectedProvider.id, model.id, state.catalog.revision, {
        ...input, providerModelId: model.id, expectedRevision: state.selectedProvider.revision,
        purpose: 'chat',
      });
      dispatch({ type: 'catalogLoaded', catalog: await client.getCatalog() });
    } catch (error) { fail(error); }
  }, [client, fail, state.catalog.revision, state.selectedProvider]);

  const archiveCatalogModel = useCallback(async (id: string, revision: number) => {
    dispatch({ type: 'busy', action: `catalog-archive-${id}` });
    try {
      await client.archiveCatalogModel(id, revision);
      dispatch({ type: 'catalogLoaded', catalog: await client.getCatalog() });
    } catch (error) { fail(error); }
  }, [client, fail]);

  const archiveInventoryModel = useCallback(async (model: ProviderModelRecord) => {
    dispatch({ type: 'busy', action: `inventory-archive-${model.id}` });
    try {
      await client.archiveProviderModel(model.id, model.revision);
      if (state.selectedProvider) {
        dispatch({ type: 'inventoryLoaded', models: await client.listProviderModels(
          state.selectedProvider.id,
        ) });
        dispatch({ type: 'catalogLoaded', catalog: await client.getCatalog() });
      }
    } catch (error) { fail(error); }
  }, [client, fail, state.selectedProvider]);

  const assignFlash = useCallback(async (model: ProviderModelRecord, input: FlashRouteInput) => {
    if (!state.runtime) return;
    dispatch({ type: 'busy', action: `flash-${model.id}` });
    try {
      const route = await client.createFlashRoute(model.id, input);
      const runtime = await client.updateRuntime({
        expectedRevision: state.runtime.revision,
        flashRouteId: route.id,
        maxInputBytes: input.maxInputBytes,
        maxOutputTokens: input.maxOutputTokens,
        requestTimeoutMs: input.requestTimeoutMs,
      });
      dispatch({ type: 'runtimeLoaded', runtime });
    } catch (error) { fail(error); }
  }, [client, fail, state.runtime]);

  const updateRuntime = useCallback(async (input: UpdateRuntimeSettingsRequest) => {
    dispatch({ type: 'busy', action: 'runtime-save' });
    try { dispatch({ type: 'runtimeLoaded', runtime: await client.updateRuntime(input) }); }
    catch (error) { fail(error); }
  }, [client, fail]);

  return {
    state, loadDashboard, selectProvider, createProvider, updateProvider, archiveProvider,
    replaceCredential, discover, publish, archiveCatalogModel, archiveInventoryModel,
    assignFlash, updateRuntime,
  };
}
