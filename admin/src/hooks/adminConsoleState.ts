import type {
  AdminProvider,
  AuditEvent,
  CatalogResponse,
  ProviderHealth,
  ProviderModelRecord,
  RuntimeSettings,
} from '../services/adminTypes';

export interface AdminConflict {
  message: string;
  currentRevision: number;
}

export interface AdminConsoleState {
  loading: boolean;
  busyAction: string | null;
  providers: AdminProvider[];
  selectedProvider: AdminProvider | null;
  inventory: ProviderModelRecord[];
  health: ProviderHealth | null;
  catalog: CatalogResponse;
  runtime: RuntimeSettings | null;
  audit: AuditEvent[];
  error: string | null;
  conflict: AdminConflict | null;
}

export type AdminConsoleAction =
  | { type: 'loading'; value: boolean }
  | { type: 'busy'; action: string | null }
  | { type: 'dashboardLoaded'; providers: AdminProvider[]; catalog: CatalogResponse;
      runtime: RuntimeSettings; audit: AuditEvent[] }
  | { type: 'providerLoaded'; provider: AdminProvider; models: ProviderModelRecord[];
      health: ProviderHealth }
  | { type: 'providerSaved'; provider: AdminProvider }
  | { type: 'inventoryLoaded'; models: ProviderModelRecord[] }
  | { type: 'catalogLoaded'; catalog: CatalogResponse }
  | { type: 'runtimeLoaded'; runtime: RuntimeSettings }
  | { type: 'credentialSaved'; provider: AdminProvider }
  | { type: 'revisionConflict'; message: string; currentRevision: number }
  | { type: 'error'; message: string }
  | { type: 'clearNotice' };

export function createInitialAdminConsoleState(): AdminConsoleState {
  return {
    loading: true,
    busyAction: null,
    providers: [],
    selectedProvider: null,
    inventory: [],
    health: null,
    catalog: { revision: 0, models: [] },
    runtime: null,
    audit: [],
    error: null,
    conflict: null,
  };
}

function replaceProvider(providers: AdminProvider[], provider: AdminProvider): AdminProvider[] {
  const exists = providers.some((item) => item.id === provider.id);
  return exists
    ? providers.map((item) => item.id === provider.id ? provider : item)
    : [provider, ...providers];
}

export function adminConsoleReducer(
  state: AdminConsoleState,
  action: AdminConsoleAction,
): AdminConsoleState {
  switch (action.type) {
    case 'loading': return { ...state, loading: action.value };
    case 'busy': return { ...state, busyAction: action.action, error: null, conflict: null };
    case 'dashboardLoaded':
      return { ...state, loading: false, providers: action.providers, catalog: action.catalog,
        runtime: action.runtime, audit: action.audit, error: null };
    case 'providerLoaded':
      return { ...state, selectedProvider: action.provider, inventory: action.models,
        health: action.health, error: null };
    case 'providerSaved':
      return { ...state, providers: replaceProvider(state.providers, action.provider),
        selectedProvider: action.provider, busyAction: null, error: null };
    case 'inventoryLoaded': return { ...state, inventory: action.models, busyAction: null };
    case 'catalogLoaded': return { ...state, catalog: action.catalog, busyAction: null };
    case 'runtimeLoaded': return { ...state, runtime: action.runtime, busyAction: null };
    case 'credentialSaved':
      return { ...state, providers: replaceProvider(state.providers, action.provider),
        selectedProvider: action.provider, busyAction: null, error: null };
    case 'revisionConflict':
      return { ...state, busyAction: null, conflict: {
        message: action.message,
        currentRevision: action.currentRevision,
      } };
    case 'error': return { ...state, loading: false, busyAction: null, error: action.message };
    case 'clearNotice': return { ...state, error: null, conflict: null };
  }
}
