import {
    activateAccount,
    clearActiveAccount,
} from '@/services/account/accountRuntime';
import {
    resetAccountStorageAdapter,
    setAccountStorageAdapter,
} from '@/services/account/accountScopedStorage';
import {
    listMemoryAtoms,
    resetMemoryStorageAdapter,
    saveManualMemoryNote,
} from '@/services/memory/localMemory';
import {
    loadGenerationSettings,
    resetGenerationSettingsStorageAdapter,
    saveGenerationSettings,
} from '@/services/ai/generationSettings';
import {
    loadSessions,
    resetChatSessionStorageAdapter,
    saveSession,
} from '@/services/ai/sessionStorage';

describe('private storage owners use the active account namespace', () => {
    const values = new Map<string, string>();

    beforeEach(async () => {
        values.clear();
        setAccountStorageAdapter({
            getItem: async (key) => values.get(key) ?? null,
            setItem: async (key, value) => { values.set(key, value); },
            removeItem: async (key) => { values.delete(key); },
            getAllKeys: async () => Array.from(values.keys()),
        });
        resetMemoryStorageAdapter();
        resetGenerationSettingsStorageAdapter();
        resetChatSessionStorageAdapter();
        await clearActiveAccount();
    });

    afterEach(async () => {
        await clearActiveAccount();
        resetAccountStorageAdapter();
    });

    it('does not expose memory, generation settings, or chat drafts after A switches to B', async () => {
        await activateAccount('user-a');
        await saveManualMemoryNote('Only user A should remember this.');
        await saveGenerationSettings({ temperature: 0.25, topP: 0.5, maxTokens: 4096 });
        await saveSession({
            conversationId: 'private-draft',
            mode: 'freeform',
            messages: [{
                id: 'message-1', role: 'user', content: 'private draft', timestamp: 1,
            }],
            createdAt: 1,
            updatedAt: 1,
        });

        await activateAccount('user-b');

        await expect(listMemoryAtoms()).resolves.toEqual([]);
        await expect(loadSessions()).resolves.toEqual([]);
        await expect(loadGenerationSettings()).resolves.toMatchObject({
            temperature: 1,
            topP: 0.95,
        });
        expect(Array.from(values.keys()).every(
            (key) => key.startsWith('@blackrose_account:v1:user-a:'),
        )).toBe(true);
    });
});
