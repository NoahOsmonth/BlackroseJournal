/* eslint-disable import/first */

/**
 * DEF-013: the demo seed used to pay ~11 serial AI extraction round-trips, so a
 * 31-row seed looked frozen for minutes (and each request could hang against an
 * unreachable provider). The seed now runs inside the deterministic memory
 * scope: memory comes from the seed's own analysis, and no memory-side provider
 * call is made at all.
 *
 * Break this suite by: removing runWithDeterministicMemoryExtraction from
 * seedDemoData (the "no provider call" cases go red), or by dropping a
 * reportStep() call (the progress case goes red).
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
        throw new Error('provider must not be called during a demo seed');
    }),
}));

import { fetchAiChatCompletion } from '../../../services/ai/aiTransport';
import {
    demoSeedStepCount,
    seedDemoData,
    setDemoSeedEnabledForTests,
} from '../../../services/seed/seedDemoData';
import type { DemoSeedProgress } from '../../../services/seed/seedDemoData';
import { listMemoryAtoms } from '../../../services/memory/localMemory';
import { listCheckIns, listIntentions } from '../../../services/intentions/intentionsStorage';
import { listGoals } from '../../../services/goals/goalsStorage';
import { listEntries } from '../../../services/journal/journalStorage';
import { activateAccount, clearActiveAccount } from '../../../services/account/accountRuntime';

const mockProvider = jest.mocked(fetchAiChatCompletion);

describe('seedDemoData — deterministic, progressing seed (DEF-013)', () => {
    beforeEach(async () => {
        mockStore.clear();
        setDemoSeedEnabledForTests(true);
        // Deliberately PRESENT: a configured provider is exactly the case that
        // used to make the seed slow. The deterministic scope must win anyway.
        process.env.EXPO_PUBLIC_NANO_GPT_API_KEY = 'test-key';
        process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL = 'http://127.0.0.1:9/v1';
        await activateAccount('seed-det-user');
    });

    afterEach(async () => {
        await clearActiveAccount();
        setDemoSeedEnabledForTests(null);
        delete process.env.EXPO_PUBLIC_NANO_GPT_API_KEY;
        delete process.env.EXPO_PUBLIC_NANO_GPT_API_BASE_URL;
        jest.clearAllMocks();
    });

    it('never calls the AI provider for memory work while seeding', async () => {
        await seedDemoData();
        expect(mockProvider).not.toHaveBeenCalled();
    });

    it('reports progress once per row, ending exactly at the stated total', async () => {
        const seen: DemoSeedProgress[] = [];
        await seedDemoData({ onProgress: (progress) => seen.push(progress) });

        const total = demoSeedStepCount();
        expect(total).toBeGreaterThan(0);
        expect(seen.at(-1)).toEqual({ completed: total, total });
        // Monotonic, one row at a time, never past the total.
        expect(seen.map((p) => p.completed)).toEqual(
            Array.from({ length: total }, (_, index) => index + 1),
        );
    });

    it('still writes the full dataset from deterministic atoms', async () => {
        await seedDemoData();

        expect(await listEntries()).toHaveLength(5);
        expect(await listIntentions()).toHaveLength(4);
        expect(await listCheckIns()).toHaveLength(6);
        expect(await listGoals()).toHaveLength(12);

        const atoms = await listMemoryAtoms();
        // Journal + check-in deterministic builders both ran.
        expect(atoms.some((atom) => atom.source === 'journal')).toBe(true);
        expect(atoms.some((atom) => atom.source === 'intention')).toBe(true);
    });
});
