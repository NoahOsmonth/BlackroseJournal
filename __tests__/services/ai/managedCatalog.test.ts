import {
    getManagedModelSelection,
    loadManagedCatalogSnapshot,
    loadManagedModelPreference,
    refreshManagedCatalog,
    resetManagedCatalogTestAdapters,
    setManagedCatalogGatewayDependencies,
    setManagedCatalogRealtimeClient,
    setManagedCatalogStorageAdapter,
    startManagedCatalogRealtime,
    subscribeManagedCatalogChanges,
    updateManagedModelPreference,
} from '../../../services/ai/managedCatalog';
import {
    activateAccount,
    clearActiveAccount,
} from '../../../services/account/accountRuntime';
import {
    resetAccountStorageAdapter,
    setAccountStorageAdapter,
} from '../../../services/account/accountScopedStorage';

const model = (id: string, availability: 'available' | 'degraded' | 'unavailable' = 'available') => ({
    id,
    label: id.toUpperCase(),
    publicModelId: `public/${id}`,
    capabilities: {
        streaming: true, tools: true, vision: false, jsonObject: true, jsonSchema: false,
    },
    contextWindow: 32_000,
    availability,
    sortOrder: 0,
    revision: 1,
    createdAt: '2026-08-24T00:00:00.000Z',
    updatedAt: '2026-08-24T00:00:00.000Z',
});

const catalog = (ids: string[], revision = 1) => ({
    revision,
    models: ids.map((id) => model(id)),
});

const preference = (selectedModelId: string | null, revision = 1) => ({
    selectedModelId,
    revision,
    updatedAt: '2026-08-24T00:00:00.000Z',
});

describe('managed AI catalog owner', () => {
    const values = new Map<string, string>();

    beforeEach(async () => {
        values.clear();
        setManagedCatalogStorageAdapter({
            getItem: async (key) => values.get(key) ?? null,
            setItem: async (key, value) => { values.set(key, value); },
            removeItem: async (key) => { values.delete(key); },
        });
        setManagedCatalogGatewayDependencies({
            fetchImpl: jest.fn(),
            getAccessToken: async () => 'token-a',
            getGatewayBaseUrl: () => 'https://gateway.example',
        });
    });

    afterEach(async () => {
        await clearActiveAccount();
        resetManagedCatalogTestAdapters();
        resetAccountStorageAdapter();
    });

    it('loads a corruption-safe versioned account cache', async () => {
        values.set('@blackrose_managed_ai_catalog', '{not-json');

        await expect(loadManagedCatalogSnapshot()).resolves.toEqual({
            catalog: null,
            preference: null,
        });
    });

    it('fetches the catalog with the authenticated gateway token and caches only validated data', async () => {
        const fetchImpl = jest.fn(async () => new Response(JSON.stringify(catalog(['alpha'], 4))));
        setManagedCatalogGatewayDependencies({
            fetchImpl,
            getAccessToken: async () => 'signed-user-token',
            getGatewayBaseUrl: () => 'https://gateway.example/',
        });

        await expect(refreshManagedCatalog()).resolves.toEqual(catalog(['alpha'], 4));
        expect(fetchImpl).toHaveBeenCalledWith(
            'https://gateway.example/v1/ai/catalog',
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: 'Bearer signed-user-token' }),
            })
        );
        await expect(loadManagedCatalogSnapshot()).resolves.toEqual({
            catalog: catalog(['alpha'], 4),
            preference: null,
        });
    });

    it('keeps the default cache isolated by authenticated account namespace', async () => {
        resetManagedCatalogTestAdapters();
        setAccountStorageAdapter({
            getItem: async (key) => values.get(key) ?? null,
            setItem: async (key, value) => { values.set(key, value); },
            removeItem: async (key) => { values.delete(key); },
        });
        setManagedCatalogGatewayDependencies({
            fetchImpl: jest.fn(async () => new Response(JSON.stringify(catalog(['alpha'])))),
            getAccessToken: async () => 'token-a',
            getGatewayBaseUrl: () => 'https://gateway.example',
        });
        await activateAccount('account-a');
        await refreshManagedCatalog();

        expect(values.has(
            '@blackrose_account:v1:account-a:blackrose_managed_ai_catalog'
        )).toBe(true);
        await activateAccount('account-b');
        await expect(loadManagedCatalogSnapshot()).resolves.toEqual({
            catalog: null, preference: null,
        });
    });

    it('keeps a withdrawn explicit selection unavailable instead of falling back', () => {
        expect(getManagedModelSelection(catalog(['replacement']), preference('withdrawn'))).toEqual({
            selectedModelId: 'withdrawn',
            model: null,
            availability: 'unavailable',
        });
    });

    it('loads and updates the explicit preference through authenticated gateway endpoints', async () => {
        const fetchImpl = jest.fn(async (_url: string, init?: RequestInit) => {
            if (init?.method === 'PUT') {
                expect(JSON.parse(String(init.body))).toEqual({
                    modelId: 'alpha', expectedRevision: 2,
                });
                return new Response(JSON.stringify(preference('alpha', 3)));
            }
            return new Response(JSON.stringify(preference('before', 2)));
        });
        setManagedCatalogGatewayDependencies({
            fetchImpl,
            getAccessToken: async () => 'token-a',
            getGatewayBaseUrl: () => 'https://gateway.example',
        });

        await expect(loadManagedModelPreference()).resolves.toEqual(preference('before', 2));
        await expect(updateManagedModelPreference('alpha', 2)).resolves.toEqual(
            preference('alpha', 3)
        );
        expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
            'https://gateway.example/v1/ai/preferences/model',
            'https://gateway.example/v1/ai/preferences/model',
        ]);
        await expect(loadManagedCatalogSnapshot()).resolves.toEqual({
            catalog: null,
            preference: preference('alpha', 3),
        });
    });

    it('serializes cache merges so simultaneous catalog and preference writes do not clobber', async () => {
        let activeWrites = 0;
        let maximumWrites = 0;
        setManagedCatalogStorageAdapter({
            getItem: async (key) => values.get(key) ?? null,
            setItem: async (key, value) => {
                activeWrites += 1;
                maximumWrites = Math.max(maximumWrites, activeWrites);
                await Promise.resolve();
                values.set(key, value);
                activeWrites -= 1;
            },
            removeItem: async (key) => { values.delete(key); },
        });
        setManagedCatalogGatewayDependencies({
            fetchImpl: jest.fn(async (url: string) => new Response(JSON.stringify(
                url.endsWith('/catalog') ? catalog(['alpha']) : preference('alpha')
            ))),
            getAccessToken: async () => 'token-a',
            getGatewayBaseUrl: () => 'https://gateway.example',
        });

        await Promise.all([refreshManagedCatalog(), loadManagedModelPreference()]);

        expect(maximumWrites).toBe(1);
        await expect(loadManagedCatalogSnapshot()).resolves.toEqual({
            catalog: catalog(['alpha']),
            preference: preference('alpha'),
        });
    });

    it('atomically refetches on revision changes and removes realtime on account switch', async () => {
        await activateAccount('account-a');
        let revisionListener: (() => void) | null = null;
        const removeChannel = jest.fn(async () => 'ok');
        const channel = {
            on: jest.fn((_event, config, listener) => {
                expect(config).toEqual({
                    event: '*', schema: 'public', table: 'ai_catalog_revision',
                });
                revisionListener = listener;
                return channel;
            }),
            subscribe: jest.fn(() => channel),
        };
        setManagedCatalogRealtimeClient({
            channel: jest.fn(() => channel),
            removeChannel,
        });
        let resolveFetch!: (response: Response) => void;
        const responseReady = new Promise<Response>((resolve) => { resolveFetch = resolve; });
        const fetchImpl = jest.fn()
            .mockImplementationOnce(() => responseReady)
            .mockResolvedValueOnce(new Response(JSON.stringify(catalog(['newest'], 3))));
        setManagedCatalogGatewayDependencies({
            fetchImpl,
            getAccessToken: async () => 'token-a',
            getGatewayBaseUrl: () => 'https://gateway.example',
        });
        const snapshots: unknown[] = [];
        const unsubscribeChanges = subscribeManagedCatalogChanges((snapshot) => {
            snapshots.push(snapshot);
        });
        const stop = startManagedCatalogRealtime();

        revisionListener?.();
        revisionListener?.();
        expect(snapshots).toHaveLength(0);
        resolveFetch(new Response(JSON.stringify(catalog(['new'], 2))));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(snapshots).toEqual([
            { catalog: catalog(['new'], 2), preference: null },
            { catalog: catalog(['newest'], 3), preference: null },
        ]);

        await activateAccount('account-b');
        expect(removeChannel).toHaveBeenCalledWith(channel);
        stop();
        unsubscribeChanges();
    });
});
