import {
    parseCatalogResponse,
    parseUserAiPreference,
    type CatalogResponse,
    type PublicCatalogModel,
    type UserAiPreference,
} from '@blackrose/ai-control-plane-contracts';
import { accountScopedStorage } from '@/services/account/accountScopedStorage';
import {
    getActiveAccountId,
    registerAccountTeardown,
} from '@/services/account/accountRuntime';
import { getSupabaseClient } from '@/services/supabase/supabaseClient';

interface StorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}

interface GatewayDependencies {
    fetchImpl: typeof fetch;
    getAccessToken(): Promise<string>;
    getGatewayBaseUrl(): string;
}

interface RealtimeChannelLike {
    on(
        event: 'postgres_changes',
        config: { event: '*'; schema: 'public'; table: 'ai_catalog_revision' },
        listener: () => void
    ): RealtimeChannelLike;
    subscribe(): RealtimeChannelLike;
}

interface RealtimeClientLike {
    channel(name: string): RealtimeChannelLike;
    removeChannel(channel: RealtimeChannelLike): Promise<unknown>;
}

interface StoredManagedCatalogSnapshot {
    readonly schemaVersion: 1;
    readonly catalog: CatalogResponse | null;
    readonly preference: UserAiPreference | null;
}

export interface ManagedCatalogSnapshot {
    readonly catalog: CatalogResponse | null;
    readonly preference: UserAiPreference | null;
}

export interface ManagedModelSelection {
    readonly selectedModelId: string | null;
    readonly model: PublicCatalogModel | null;
    readonly availability: 'available' | 'degraded' | 'unavailable' | 'unselected';
}

export const MANAGED_AI_CATALOG_STORAGE_KEY = '@blackrose_managed_ai_catalog';

const EMPTY_SNAPSHOT: StoredManagedCatalogSnapshot = {
    schemaVersion: 1,
    catalog: null,
    preference: null,
};

let storageAdapter: StorageAdapter = accountScopedStorage;
let gatewayDependencies: GatewayDependencies = createDefaultGatewayDependencies();
let realtimeClientOverride: RealtimeClientLike | null | undefined;
let mutationQueue: Promise<void> = Promise.resolve();
let catalogRefreshPromise: Promise<CatalogResponse> | null = null;
let realtimeChannel: RealtimeChannelLike | null = null;
let realtimeClient: RealtimeClientLike | null = null;
let realtimeConsumers = 0;
let realtimeRefetchRequested = false;
let realtimeRefetchLoop: Promise<void> | null = null;
let accountEpoch = 0;
const activeRequests = new Set<AbortController>();
const listeners = new Set<(snapshot: ManagedCatalogSnapshot) => void>();

function defaultGatewayBaseUrl(): string {
    const configured = (process.env.EXPO_PUBLIC_AGENT_BASE_URL ?? '').trim();
    if (!configured) {
        throw new Error('Managed AI gateway is not configured.');
    }
    return configured.replace(/\/+$/, '');
}

async function defaultAccessToken(): Promise<string> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase authentication is not configured.');
    const { data, error } = await client.auth.getSession();
    if (error) throw new Error(error.message);
    const token = data.session?.access_token;
    if (!token || data.session?.user?.is_anonymous) {
        throw new Error('Managed AI requires an authenticated account.');
    }
    return token;
}

function createDefaultGatewayDependencies(): GatewayDependencies {
    return {
        // Bound explicitly: passing bare `fetch` loses its receiver, which
        // browsers reject at call time with "Illegal invocation".
        fetchImpl: (...args) => fetch(...args),
        getAccessToken: defaultAccessToken,
        getGatewayBaseUrl: defaultGatewayBaseUrl,
    };
}

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

function parseStoredSnapshot(raw: string | null): StoredManagedCatalogSnapshot {
    if (!raw) return EMPTY_SNAPSHOT;
    try {
        const value = JSON.parse(raw) as unknown;
        if (!value || typeof value !== 'object' || Array.isArray(value)) return EMPTY_SNAPSHOT;
        const record = value as Record<string, unknown>;
        if (record.schemaVersion !== 1) return EMPTY_SNAPSHOT;
        return {
            schemaVersion: 1,
            catalog: record.catalog === null ? null : parseCatalogResponse(record.catalog),
            preference: record.preference === null
                ? null
                : parseUserAiPreference(record.preference),
        };
    } catch {
        return EMPTY_SNAPSHOT;
    }
}

async function loadStoredSnapshot(): Promise<StoredManagedCatalogSnapshot> {
    return parseStoredSnapshot(await storageAdapter.getItem(MANAGED_AI_CATALOG_STORAGE_KEY));
}

function toPublicSnapshot(stored: StoredManagedCatalogSnapshot): ManagedCatalogSnapshot {
    return { catalog: stored.catalog, preference: stored.preference };
}

async function mergeStoredSnapshot(
    partial: Partial<Pick<StoredManagedCatalogSnapshot, 'catalog' | 'preference'>>
): Promise<ManagedCatalogSnapshot> {
    return enqueueMutation(async () => {
        const current = await loadStoredSnapshot();
        const next: StoredManagedCatalogSnapshot = { ...current, ...partial, schemaVersion: 1 };
        await storageAdapter.setItem(MANAGED_AI_CATALOG_STORAGE_KEY, JSON.stringify(next));
        return toPublicSnapshot(next);
    });
}

function emit(snapshot: ManagedCatalogSnapshot): void {
    listeners.forEach((listener) => {
        try {
            listener(snapshot);
        } catch {
            // A consumer cannot prevent the data owner from notifying the rest.
        }
    });
}

function assertAccountEpoch(expectedEpoch: number, expectedAccountId: string | null): void {
    if (expectedEpoch !== accountEpoch || expectedAccountId !== getActiveAccountId()) {
        throw new Error('Managed AI request was cancelled by an account switch.');
    }
}

async function gatewayRequest(path: string, init?: RequestInit): Promise<unknown> {
    const token = await gatewayDependencies.getAccessToken();
    const controller = new AbortController();
    activeRequests.add(controller);
    try {
        const response = await gatewayDependencies.fetchImpl(
            `${gatewayDependencies.getGatewayBaseUrl().replace(/\/+$/, '')}${path}`,
            {
                ...init,
                signal: controller.signal,
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${token}`,
                    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
                    ...init?.headers,
                },
            }
        );
        if (!response.ok) {
            throw new Error(`Managed AI gateway request failed (${response.status}).`);
        }
        return await response.json();
    } finally {
        activeRequests.delete(controller);
    }
}

export async function loadManagedCatalogSnapshot(): Promise<ManagedCatalogSnapshot> {
    return toPublicSnapshot(await loadStoredSnapshot());
}

export function refreshManagedCatalog(): Promise<CatalogResponse> {
    if (catalogRefreshPromise) return catalogRefreshPromise;
    const expectedEpoch = accountEpoch;
    const expectedAccountId = getActiveAccountId();
    const operation = (async () => {
        const catalog = parseCatalogResponse(await gatewayRequest('/v1/ai/catalog'));
        assertAccountEpoch(expectedEpoch, expectedAccountId);
        const snapshot = await mergeStoredSnapshot({ catalog });
        assertAccountEpoch(expectedEpoch, expectedAccountId);
        emit(snapshot);
        return catalog;
    })();
    catalogRefreshPromise = operation;
    void operation.finally(() => {
        if (catalogRefreshPromise === operation) catalogRefreshPromise = null;
    }).catch(() => undefined);
    return operation;
}

export async function loadManagedModelPreference(): Promise<UserAiPreference> {
    const expectedEpoch = accountEpoch;
    const expectedAccountId = getActiveAccountId();
    const preference = parseUserAiPreference(
        await gatewayRequest('/v1/ai/preferences/model')
    );
    assertAccountEpoch(expectedEpoch, expectedAccountId);
    const snapshot = await mergeStoredSnapshot({ preference });
    assertAccountEpoch(expectedEpoch, expectedAccountId);
    emit(snapshot);
    return preference;
}

export async function updateManagedModelPreference(
    modelId: string,
    expectedRevision?: number
): Promise<UserAiPreference> {
    const expectedEpoch = accountEpoch;
    const expectedAccountId = getActiveAccountId();
    const request = expectedRevision === undefined
        ? { modelId }
        : { modelId, expectedRevision };
    const preference = parseUserAiPreference(await gatewayRequest(
        '/v1/ai/preferences/model',
        { method: 'PUT', body: JSON.stringify(request) }
    ));
    assertAccountEpoch(expectedEpoch, expectedAccountId);
    const snapshot = await mergeStoredSnapshot({ preference });
    assertAccountEpoch(expectedEpoch, expectedAccountId);
    emit(snapshot);
    return preference;
}

export function getManagedModelSelection(
    catalog: CatalogResponse | null,
    preference: UserAiPreference | null
): ManagedModelSelection {
    const selectedModelId = preference?.selectedModelId ?? null;
    if (!selectedModelId) {
        return { selectedModelId: null, model: null, availability: 'unselected' };
    }
    const model = catalog?.models.find((candidate) => candidate.id === selectedModelId) ?? null;
    return {
        selectedModelId,
        model,
        availability: model?.availability ?? 'unavailable',
    };
}

export function subscribeManagedCatalogChanges(
    listener: (snapshot: ManagedCatalogSnapshot) => void
): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function resolveRealtimeClient(): RealtimeClientLike | null {
    if (realtimeClientOverride !== undefined) return realtimeClientOverride;
    return getSupabaseClient() as unknown as RealtimeClientLike | null;
}

async function removeRealtimeChannel(): Promise<void> {
    const channel = realtimeChannel;
    const client = realtimeClient;
    realtimeChannel = null;
    realtimeClient = null;
    if (channel && client) {
        await client.removeChannel(channel).catch(() => undefined);
    }
}

function scheduleRealtimeRefetch(): void {
    realtimeRefetchRequested = true;
    if (realtimeRefetchLoop) return;
    const expectedEpoch = accountEpoch;
    const operation = (async () => {
        while (realtimeRefetchRequested && expectedEpoch === accountEpoch) {
            realtimeRefetchRequested = false;
            await refreshManagedCatalog().catch(() => undefined);
        }
    })();
    realtimeRefetchLoop = operation;
    void operation.finally(() => {
        if (realtimeRefetchLoop === operation) realtimeRefetchLoop = null;
        if (realtimeRefetchRequested && expectedEpoch === accountEpoch) {
            scheduleRealtimeRefetch();
        }
    }).catch(() => undefined);
}

export function startManagedCatalogRealtime(): () => void {
    realtimeConsumers += 1;
    if (!realtimeChannel) {
        const client = resolveRealtimeClient();
        if (client) {
            realtimeClient = client;
            realtimeChannel = client
                .channel(`managed-ai-catalog:${getActiveAccountId() ?? 'unknown'}`)
                .on('postgres_changes', {
                    event: '*', schema: 'public', table: 'ai_catalog_revision',
                }, () => {
                    scheduleRealtimeRefetch();
                })
                .subscribe();
        }
    }
    let stopped = false;
    return () => {
        if (stopped) return;
        stopped = true;
        realtimeConsumers = Math.max(0, realtimeConsumers - 1);
        if (realtimeConsumers === 0) void removeRealtimeChannel();
    };
}

export function setManagedCatalogStorageAdapter(adapter: StorageAdapter): void {
    storageAdapter = adapter;
}

export function setManagedCatalogGatewayDependencies(dependencies: GatewayDependencies): void {
    gatewayDependencies = dependencies;
}

export function setManagedCatalogRealtimeClient(client: RealtimeClientLike | null): void {
    realtimeClientOverride = client;
}

export function resetManagedCatalogTestAdapters(): void {
    storageAdapter = accountScopedStorage;
    gatewayDependencies = createDefaultGatewayDependencies();
    realtimeClientOverride = undefined;
    listeners.clear();
}

registerAccountTeardown(async () => {
    accountEpoch += 1;
    activeRequests.forEach((controller) => controller.abort());
    catalogRefreshPromise = null;
    realtimeRefetchRequested = false;
    realtimeRefetchLoop = null;
    realtimeConsumers = 0;
    await removeRealtimeChannel();
    await mutationQueue;
});
