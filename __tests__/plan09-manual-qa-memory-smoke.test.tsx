/* eslint-disable import/first */
/**
 * End-to-end manual-QA smoke test for Plan 09 — the memory half.
 *
 * Exercises the user flows from Phase E §4 against the actual service code and
 * a real AsyncStorage round-trip (no mocks of the units under test). Only QA12
 * can reach a model, and it soft-fails to a deterministic fallback — see the
 * timeout note below. Mirrors what would happen in the app when a user taps
 * through:
 *   - QA10:   + FAB journal chat regression (storage round-trip)
 *   - QA11:   Manual memory note propagation through the change-subscription hook
 *   - QA12:   Journal entry -> memory atoms (graph view-model)
 *   - QA13:   Crash-safe memory load (corrupt payload -> clean state)
 *
 * Split out of `plan09-manual-qa-smoke.test.tsx` to stay under the 300-line test
 * cap (AGENTS.md). The harness below is deliberately a copy of that file's: the
 * in-memory AsyncStorage mock has to be declared per test file (`jest.mock` is
 * hoisted and registered per module registry), which is how every other storage
 * suite in this repo does it.
 */

jest.mock('@react-native-async-storage/async-storage', () => {
    const store = new Map<string, string>();
    return {
        __esModule: true,
        default: {
            getItem: async (key: string) => store.get(key) ?? null,
            setItem: async (key: string, value: string) => { store.set(key, value); },
            removeItem: async (key: string) => { store.delete(key); },
            __getStore: () => store,
            __clear: () => store.clear(),
        },
    };
});

// QA12 is the one flow here that can reach a model: `saveJournalEntryMemories`
// calls `extractJournalMemoryAtoms`, which soft-fails to a deterministic
// extractive fallback when the provider is down — so it passes either way, and
// there is no health check to skip on. QA11 and QA13 write through
// `saveExploreNote`, which is model-free by design (it derives the title and
// tags locally). The 180s timeout is headroom for the extraction round-trip,
// not for `generateEntryTitle` or a `backendHealthy()` skip: neither exists in
// this file. Both belong to the goals/intentions half, whose harness this one
// was copied from.
jest.setTimeout(180000);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useLocalMemories } from '../hooks/memory/useLocalMemories';
import { useLocalMemoryContext } from '../hooks/memory/useLocalMemoryContext';
import { saveJournalEntryMemories } from '../services/memory/localMemory';
import type { JournalEntry } from '../services/journal/journalStorage.types';
import { activateAccount, clearActiveAccount } from '../services/account/accountRuntime';
import { getAccountScopedStorageKey } from '../services/account/accountScopedStorage';

const store = (AsyncStorage as unknown as { __getStore: () => Map<string, string> }).__getStore();
const clearStore = (AsyncStorage as unknown as { __clear: () => void }).__clear;

describe('Plan 09 manual-QA memory smoke test', () => {
    beforeEach(async () => {
        clearStore();
        await activateAccount('manual-qa-user');
    });

    afterEach(async () => {
        await clearActiveAccount();
    });

    it('QA10: + FAB journal storage round-trip', async () => {
        // Simulate the journal chat save path
        const journalEntry = {
            id: `journal_${Date.now()}`,
            title: 'A calm morning',
            emoji: '☀️',
            status: 'completed' as const,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [
                { id: 'j1', role: 'user' as const, content: 'I want to take slow mornings this week.', timestamp: Date.now() },
            ],
            analysis: {
                insight: 'The user values slow mornings.',
                quote: 'Slow is steady.',
                mood: 'Calm',
                topics: ['mornings', 'pace'],
                generatedAt: Date.now(),
            },
        };

        const map = {
            [journalEntry.id]: journalEntry,
        };
        store.set(getAccountScopedStorageKey('@journal_entries'), JSON.stringify(map));
        const rehydrated = JSON.parse(store.get(getAccountScopedStorageKey('@journal_entries')) ?? '{}');
        expect(rehydrated[journalEntry.id].title).toBe('A calm morning');
        expect(rehydrated[journalEntry.id].messages[0].content).toContain('slow mornings');
    });

    it('QA11: an Explore note propagates to useLocalMemoryContext without reload (subscription works)', async () => {
        const memories = renderHook(() => useLocalMemories());
        const context = renderHook(() => useLocalMemoryContext({ query: 'calm' }));

        await waitFor(() => expect(memories.result.current.isLoading).toBe(false));
        await waitFor(() => expect(context.result.current.isLoading).toBe(false));

        await act(async () => {
            // `addExploreNote` is the supported way to write a note from
            // Explore now — it fans out to entry + atom + memory file + digest.
            await memories.result.current.addExploreNote('Calm mornings mean a gentler afternoon.');
        });

        // Both hooks should see the new note without manual refresh
        await waitFor(() => {
            const titles = memories.result.current.atoms.map((a) => a.title);
            expect(titles).toContain('Calm mornings mean a gentler afternoon.');
        });
        await waitFor(() => {
            const ctx = context.result.current.context;
            expect(ctx).toBeDefined();
        });
    });

    it('QA12: finishing a journal entry materialises memory atoms visible to the graph', async () => {
        const entry: JournalEntry = {
            id: `entry_${Date.now()}`,
            title: 'Slow mornings',
            emoji: '☀️',
            status: 'completed',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [
                { id: 'jm1', role: 'user', content: 'I noticed slow mornings make my afternoon calm.', timestamp: Date.now() },
            ],
            analysis: {
                insight: 'Slow mornings correlate with calmer afternoons.',
                quote: 'Slow is steady.',
                mood: 'Calm',
                topics: ['mornings', 'pace', 'calm'],
                generatedAt: Date.now(),
            },
        };

        const atoms = await saveJournalEntryMemories(entry);
        expect(atoms.length).toBeGreaterThanOrEqual(2);
        const layers = atoms.map((a) => a.layer);
        expect(layers).toEqual(expect.arrayContaining(['episodic']));
        expect(atoms.every((a) => a.title.toLowerCase() !== 'about the user')).toBe(true);
        expect(atoms.every((a) => a.rootSourceId === entry.id)).toBe(true);

        // The hook (and therefore the graph) should see them
        const { result } = renderHook(() => useLocalMemories());
        await waitFor(() => expect(result.current.atoms.length).toBeGreaterThanOrEqual(2));

        // Convert to graph display model: salience 1-10, ISO date string
        const graphAtoms = result.current.atoms
            .filter((a) => a.rootSourceId === entry.id || a.sourceId === entry.id)
            .map((a) => ({
                id: a.id,
                entryId: a.rootSourceId ?? a.sourceId ?? a.id,
                title: a.title,
                content: a.content,
                layer: a.layer,
                salience: Math.max(1, Math.round(a.salience * 10)),
                confidence: a.confidence,
                tags: a.tags,
                createdAt: new Date(a.createdAt).toISOString(),
            }));
        expect(graphAtoms.length).toBeGreaterThanOrEqual(2);
        graphAtoms.forEach((a) => {
            expect(typeof a.createdAt).toBe('string');
            expect(a.salience).toBeGreaterThanOrEqual(1);
            expect(a.salience).toBeLessThanOrEqual(10);
        });
    });

    it('QA13: corrupt memory payload recovers without crash and writes the sharded store', async () => {
        const memoryKey = getAccountScopedStorageKey('@rosebud_local_memory');
        const corruptMemoryKey = getAccountScopedStorageKey('@rosebud_local_memory_corrupt');
        // Simulate the user opening the app after an interrupted write
        store.set(memoryKey, '{not json');

        // The next read should not throw
        const memories1 = renderHook(() => useLocalMemories());
        await waitFor(() => expect(memories1.result.current.isLoading).toBe(false));
        expect(memories1.result.current.atoms).toEqual([]);

        // Corrupt payload should be backed up, main key cleared
        expect(store.get(corruptMemoryKey)).toBe('{not json');
        expect(store.has(memoryKey)).toBe(false);

        // First write creates the sharded store: a header index plus atom shards
        await act(async () => {
            await memories1.result.current.addExploreNote('Hello, post-crash world.');
        });

        const index = JSON.parse(store.get(memoryKey) ?? '{}');
        expect(index.schemaVersion).toBe(3);
        expect(index.atomCount).toBe(1);
        expect(index.atoms).toBeUndefined();

        // Account scoping strips the leading '@', so match on the key body.
        const shards = [...store.keys()].filter((key) => key.includes('rosebud_local_memory_shard:'));
        expect(shards).toHaveLength(1);
        expect(Object.keys(JSON.parse(store.get(shards[0]) ?? '{}').atoms)).toHaveLength(1);
    });
});
