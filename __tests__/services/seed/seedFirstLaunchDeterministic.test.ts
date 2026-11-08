/* eslint-disable import/first */

/**
 * The FIRST-LAUNCH seed is a different function from seedDemoData(), and it
 * used to miss the deterministic-memory scope that seedDemoData() already had.
 * Consequence on a real cold mount: 23 settings loads, 11 AI extraction calls
 * and 451 storage reads before anything painted — even though the seed rows
 * carry their own analysis and the provider is optional here.
 *
 * Break this suite by: removing runWithDeterministicMemoryExtraction from
 * seedDemoDataIfFirstLaunch (both provider cases go red).
 */

const mockStore = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
        setItem: jest.fn(async (key: string, value: string) => {
            mockStore.set(key, value);
        }),
        removeItem: jest.fn(async (key: string) => {
            mockStore.delete(key);
        }),
    },
}));

jest.mock('../../../services/ai/aiTransport', () => ({
    fetchAiChatCompletion: jest.fn(async () => {
        throw new Error('provider must not be called during a first-launch seed');
    }),
}));

import { fetchAiChatCompletion } from '../../../services/ai/aiTransport';
import {
    seedDemoDataIfFirstLaunch,
    setDemoSeedEnabledForTests,
} from '../../../services/seed/seedDemoData';
import { listEntries } from '../../../services/journal/journalStorage';
import { listMemoryAtoms } from '../../../services/memory/localMemory';
import { activateAccount, clearActiveAccount } from '../../../services/account/accountRuntime';

const mockProvider = jest.mocked(fetchAiChatCompletion);

describe('seedDemoDataIfFirstLaunch — no AI round-trips on boot', () => {
    beforeEach(async () => {
        mockStore.clear();
        setDemoSeedEnabledForTests(true);
        // A configured provider is the case that hurt: every seeded row used to
        // resolve settings and fire an extraction against it.
        process.env.EXPO_PUBLIC_AI_CUSTOM_API_KEY = 'test-key';
        process.env.EXPO_PUBLIC_AI_CUSTOM_BASE = 'http://127.0.0.1:9/v1';
        await activateAccount('acct-first-launch');
    });

    afterEach(async () => {
        await clearActiveAccount();
        setDemoSeedEnabledForTests(null);
        delete process.env.EXPO_PUBLIC_AI_CUSTOM_API_KEY;
        delete process.env.EXPO_PUBLIC_AI_CUSTOM_BASE;
        jest.clearAllMocks();
    });

    it('seeds the dataset without calling the AI provider', async () => {
        const seeded = await seedDemoDataIfFirstLaunch();

        expect(seeded).toBe(true);
        expect(mockProvider).not.toHaveBeenCalled();
        expect(await listEntries()).toHaveLength(5);
    });

    it('still writes deterministic memory atoms for the seeded rows', async () => {
        await seedDemoDataIfFirstLaunch();

        const atoms = await listMemoryAtoms();
        expect(atoms.some((atom) => atom.source === 'journal')).toBe(true);
        expect(atoms.some((atom) => atom.source === 'intention')).toBe(true);
    });

    it('is a no-op on the second launch', async () => {
        await seedDemoDataIfFirstLaunch();
        const again = await seedDemoDataIfFirstLaunch();

        expect(again).toBe(false);
        expect(await listEntries()).toHaveLength(5);
    });
});
