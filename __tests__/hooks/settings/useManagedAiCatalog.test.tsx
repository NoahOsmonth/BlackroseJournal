/* eslint-disable import/first */

import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockCachedSnapshots = new Map<string, {
    catalog: ReturnType<typeof catalog> | null;
    preference: ReturnType<typeof preference> | null;
}>();
let mockAccountId = 'account-a';
let mockOffline = false;
let mockServiceListener: ((snapshot: unknown) => void) | null = null;
const mockStopRealtime = jest.fn();
const mockStartRealtime = jest.fn(() => mockStopRealtime);
const mockRefreshCatalog = jest.fn();
const mockLoadPreference = jest.fn();
const mockUpdatePreference = jest.fn();

const model = (id: string) => ({
    id,
    label: id,
    publicModelId: `public/${id}`,
    capabilities: {
        streaming: true, tools: false, vision: false, jsonObject: false, jsonSchema: false,
    },
    contextWindow: 32_000,
    availability: 'available' as const,
    sortOrder: 0,
    revision: 1,
    createdAt: '2026-08-24T00:00:00.000Z',
    updatedAt: '2026-08-24T00:00:00.000Z',
});
const catalog = (ids: string[]) => ({ revision: 1, models: ids.map(model) });
const preference = (selectedModelId: string | null, revision = 1) => ({
    selectedModelId, revision, updatedAt: '2026-08-24T00:00:00.000Z',
});

jest.mock('../../../hooks/auth/useAuthSession', () => ({
    useAuthSession: () => ({
        user: { id: mockAccountId },
        isOffline: mockOffline,
        isAuthenticated: true,
        isLoading: false,
    }),
}));

jest.mock('../../../services/ai/managedCatalog', () => {
    const actual = jest.requireActual('../../../services/ai/managedCatalog');
    return {
        ...actual,
        loadManagedCatalogSnapshot: jest.fn(() => Promise.resolve(
            mockCachedSnapshots.get(mockAccountId) ?? { catalog: null, preference: null }
        )),
        refreshManagedCatalog: (...args: unknown[]) => mockRefreshCatalog(...args),
        loadManagedModelPreference: (...args: unknown[]) => mockLoadPreference(...args),
        updateManagedModelPreference: (...args: unknown[]) => mockUpdatePreference(...args),
        subscribeManagedCatalogChanges: jest.fn((listener) => {
            mockServiceListener = listener;
            return () => { mockServiceListener = null; };
        }),
        startManagedCatalogRealtime: () => mockStartRealtime(),
    };
});

import { useManagedAiCatalog } from '../../../hooks/settings/useManagedAiCatalog';

describe('useManagedAiCatalog', () => {
    beforeEach(() => {
        mockCachedSnapshots.clear();
        mockAccountId = 'account-a';
        mockOffline = false;
        mockServiceListener = null;
        mockStopRealtime.mockClear();
        mockStartRealtime.mockClear();
        mockRefreshCatalog.mockReset().mockResolvedValue(catalog(['remote']));
        mockLoadPreference.mockReset().mockResolvedValue(preference('remote'));
        mockUpdatePreference.mockReset().mockResolvedValue(preference('chosen', 2));
    });

    it('shows the account cache first, then accepts an atomic realtime snapshot', async () => {
        mockCachedSnapshots.set('account-a', {
            catalog: catalog(['cached']),
            preference: preference('withdrawn'),
        });
        const { result } = renderHook(() => useManagedAiCatalog());

        await waitFor(() => expect(result.current.catalog?.models[0]?.id).toBe('cached'));
        expect(result.current.selection).toEqual({
            selectedModelId: 'withdrawn', model: null, availability: 'unavailable',
        });
        expect(mockStartRealtime).toHaveBeenCalledTimes(1);

        act(() => {
            mockServiceListener?.({
                catalog: catalog(['new']), preference: preference('new'),
            });
        });
        expect(result.current.catalog?.models[0]?.id).toBe('new');
        expect(result.current.selection.model?.id).toBe('new');
    });

    it('tears down and reloads the owner when the authenticated account changes', async () => {
        mockCachedSnapshots.set('account-a', {
            catalog: catalog(['a']), preference: preference('a'),
        });
        mockCachedSnapshots.set('account-b', {
            catalog: catalog(['b']), preference: preference('b'),
        });
        const { result, rerender } = renderHook(() => useManagedAiCatalog());
        await waitFor(() => expect(result.current.selection.model?.id).toBe('a'));

        mockAccountId = 'account-b';
        rerender({});

        await waitFor(() => expect(result.current.selection.model?.id).toBe('b'));
        expect(mockStopRealtime).toHaveBeenCalledTimes(1);
        expect(mockStartRealtime).toHaveBeenCalledTimes(2);
    });

    it('updates only the explicit gateway preference using its current revision', async () => {
        mockCachedSnapshots.set('account-a', {
            catalog: catalog(['chosen']), preference: preference('before', 1),
        });
        const { result } = renderHook(() => useManagedAiCatalog());
        await waitFor(() => expect(result.current.preference?.revision).toBe(1));

        await act(async () => result.current.selectModel('chosen'));

        expect(mockUpdatePreference).toHaveBeenCalledWith('chosen', 1);
    });

    it('uses cache without starting realtime or gateway refresh while offline', async () => {
        mockOffline = true;
        mockCachedSnapshots.set('account-a', {
            catalog: catalog(['cached']), preference: preference('cached'),
        });
        const { result } = renderHook(() => useManagedAiCatalog());

        await waitFor(() => expect(result.current.selection.model?.id).toBe('cached'));
        expect(mockStartRealtime).not.toHaveBeenCalled();
        expect(mockRefreshCatalog).not.toHaveBeenCalled();
        expect(mockLoadPreference).not.toHaveBeenCalled();
    });

    it('does not load or subscribe while managed mode is disabled', async () => {
        const { result } = renderHook(() => useManagedAiCatalog({ enabled: false }));

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(mockStartRealtime).not.toHaveBeenCalled();
        expect(mockRefreshCatalog).not.toHaveBeenCalled();
        expect(mockLoadPreference).not.toHaveBeenCalled();
    });
});
