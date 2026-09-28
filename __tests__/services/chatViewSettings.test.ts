import {
    CHAT_VIEW_SETTINGS_KEY,
    CHAT_VIEW_SETTINGS_SCHEMA_VERSION,
    DEFAULT_CHAT_VIEW_SETTINGS,
    loadChatViewSettings,
    resetChatViewSettings,
    resetChatViewSettingsStorageAdapter,
    sanitizeChatViewSettings,
    saveChatViewSettings,
    setChatViewSettingsStorageAdapter,
} from '@/services/ai/chatViewSettings';
import {
    activateAccount,
    clearActiveAccount,
} from '@/services/account/accountRuntime';
import {
    resetAccountStorageAdapter,
    setAccountStorageAdapter,
    getAccountScopedStorageKey,
} from '@/services/account/accountScopedStorage';

describe('chatViewSettings', () => {
    const values = new Map<string, string>();

    const adapter = {
        getItem: async (key: string) => values.get(key) ?? null,
        setItem: async (key: string, value: string) => { values.set(key, value); },
        removeItem: async (key: string) => { values.delete(key); },
    };

    beforeEach(() => {
        values.clear();
        setChatViewSettingsStorageAdapter(adapter);
    });

    afterEach(() => {
        resetChatViewSettingsStorageAdapter();
    });

    it('shows the work layer by default — the toggle hides it, it does not gate it', async () => {
        await expect(loadChatViewSettings()).resolves.toEqual(DEFAULT_CHAT_VIEW_SETTINGS);
        expect(DEFAULT_CHAT_VIEW_SETTINGS.showThinking).toBe(true);
    });

    it('persists the switch inside a versioned envelope', async () => {
        await saveChatViewSettings({ showThinking: false });

        const raw = values.get(CHAT_VIEW_SETTINGS_KEY);
        expect(raw).toBeTruthy();
        expect(JSON.parse(String(raw))).toEqual({
            schemaVersion: CHAT_VIEW_SETTINGS_SCHEMA_VERSION,
            settings: { showThinking: false },
        });
        await expect(loadChatViewSettings()).resolves.toEqual({ showThinking: false });
    });

    it('reads a legacy bare record written before the envelope existed', async () => {
        values.set(CHAT_VIEW_SETTINGS_KEY, JSON.stringify({ showThinking: false }));

        await expect(loadChatViewSettings()).resolves.toEqual({ showThinking: false });
    });

    it('falls back to the default on a corrupt payload instead of wedging the transcript', async () => {
        values.set(CHAT_VIEW_SETTINGS_KEY, '{ not json');

        await expect(loadChatViewSettings()).resolves.toEqual(DEFAULT_CHAT_VIEW_SETTINGS);
    });

    it('ignores a non-boolean switch rather than trusting it', () => {
        expect(sanitizeChatViewSettings({ showThinking: 'nope' as unknown as boolean }))
            .toEqual(DEFAULT_CHAT_VIEW_SETTINGS);
        expect(sanitizeChatViewSettings(null)).toEqual(DEFAULT_CHAT_VIEW_SETTINGS);
    });

    it('keeps the other field when saving a partial update', async () => {
        await saveChatViewSettings({ showThinking: false });
        await expect(saveChatViewSettings({ showThinking: true })).resolves.toEqual({
            showThinking: true,
        });
    });

    it('clears back to the default on reset', async () => {
        await saveChatViewSettings({ showThinking: false });

        await expect(resetChatViewSettings()).resolves.toEqual(DEFAULT_CHAT_VIEW_SETTINGS);
        expect(values.has(CHAT_VIEW_SETTINGS_KEY)).toBe(false);
    });

    it('stores through the active account namespace on the default adapter', async () => {
        const accountValues = new Map<string, string>();
        setAccountStorageAdapter({
            getItem: async (key) => accountValues.get(key) ?? null,
            setItem: async (key, value) => { accountValues.set(key, value); },
            removeItem: async (key) => { accountValues.delete(key); },
            getAllKeys: async () => Array.from(accountValues.keys()),
        });
        resetChatViewSettingsStorageAdapter();
        await clearActiveAccount();
        await activateAccount('user-a');

        await saveChatViewSettings({ showThinking: false });

        // The default adapter is account-scoped: the raw key is namespaced.
        expect(accountValues.has(getAccountScopedStorageKey(CHAT_VIEW_SETTINGS_KEY))).toBe(true);
        await expect(loadChatViewSettings()).resolves.toEqual({ showThinking: false });

        await clearActiveAccount();
        resetAccountStorageAdapter();
    });
});
