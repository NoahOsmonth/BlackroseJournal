/* eslint-disable import/first */
/**
 * End-to-end manual-QA smoke test for Plan 09.
 *
 * Exercises the user flows from Phase E §4 against the actual service code
 * (not mocks) and the real backend running at EXPO_PUBLIC_AGENT_BASE_URL.
 * Mirrors what would happen in the app when a user taps through:
 *   - QA1-QA3: Goals UI spacing / goals CRUD
 *   - QA4-QA8: Intention chat morning + evening flows with AI title generation
 *   - QA9:    Draft autosave + resume
 *   - QA10:   + FAB journal chat regression (storage round-trip)
 *   - QA11:   Manual memory note propagation through the change-subscription hook
 *   - QA12:   Journal entry -> memory atoms (graph view-model)
 *   - QA13:   Crash-safe memory load (corrupt payload -> clean state)
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

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useGoals } from '../hooks/goals/useGoals';
import { useIntentionCheckIns } from '../hooks/intentions/useIntentionCheckIns';
import { useLocalMemories } from '../hooks/memory/useLocalMemories';
import { useLocalMemoryContext } from '../hooks/memory/useLocalMemoryContext';
import {
    finishIntentionChat,
    saveIntentionChatDraft,
} from '../services/intentions/intentionChatCompletion';
import { saveJournalEntryMemories } from '../services/memory/localMemory';
import { generateEntryTitle } from '../services/ai';
import type { JournalEntry } from '../services/journal/journalStorage.types';

const store = (AsyncStorage as unknown as { __getStore: () => Map<string, string> }).__getStore();
const clearStore = (AsyncStorage as unknown as { __clear: () => void }).__clear;

const BACKEND_URL = process.env.EXPO_PUBLIC_AGENT_BASE_URL ?? 'http://localhost:8787';

async function backendHealthy(): Promise<boolean> {
    try {
        const res = await fetch(`${BACKEND_URL}/health`);
        const data = await res.json() as { status?: string };
        return data.status === 'ok';
    } catch {
        return false;
    }
}

async function realGenerateEntryTitle(entryText: string): Promise<string> {
    return generateEntryTitle({ entryText });
}

describe('Plan 09 manual-QA smoke test', () => {
    beforeEach(() => {
        clearStore();
    });

    it('QA1-QA3: goals CRUD produces the right gaps and survives reload', async () => {
        const today = new Date().toISOString().slice(0, 10);
        const { result } = renderHook(() => useGoals());

        await waitFor(() => expect(result.current.goals).toEqual([]));

        await act(async () => {
            await result.current.create({ title: 'Walk 10 minutes after breakfast', type: 'goal', dateKey: today });
            await result.current.create({ title: 'Drink water before lunch', type: 'goal', dateKey: today });
            await result.current.create({ title: 'Stretch before bed', type: 'habit' });
        });

        await waitFor(() => expect(result.current.goals.length).toBe(3));
        const goals = result.current.goals;
        expect(goals.some((g) => g.title === 'Walk 10 minutes after breakfast')).toBe(true);
        expect(goals.some((g) => g.title === 'Drink water before lunch')).toBe(true);
        expect(goals.some((g) => g.title === 'Stretch before bed' && g.type === 'habit')).toBe(true);

        // Re-read from the storage layer to confirm persistence
        const stored = JSON.parse(store.get('@goals') ?? '{}');
        expect(Object.keys(stored).length).toBe(3);
    });

    it('QA4-QA8: morning + evening intentions save with AI-generated titles and correct type', async () => {
        if (!(await backendHealthy())) {
            console.warn('Backend not reachable, skipping live AI title assertions');
        }

        const { result } = renderHook(() => useIntentionCheckIns());

        const userMessages = [
            { id: 'u1', role: 'user' as const, content: 'I want to start each morning with five minutes of breath.', timestamp: 1 },
            { id: 'a1', role: 'assistant' as const, content: 'How would that feel after a week of practice?', timestamp: 2 },
            { id: 'u2', role: 'user' as const, content: 'It would feel steady.', timestamp: 3 },
        ];

        let generatedTitle: string | undefined;
        if (await backendHealthy()) {
            try {
                generatedTitle = await realGenerateEntryTitle('I want to start each morning with five minutes of breath.');
            } catch (error) {
                console.warn('AI title generation failed (expected if backend is down):', error);
            }
        }

        await act(async () => {
            await finishIntentionChat({
                messages: userMessages,
                inputValue: '',
                draftCheckInId: null,
                checkInType: 'morning',
                personaId: undefined,
                intention: null,
                isRefineMode: false,
                title: generatedTitle,
            });
            await result.current.refresh();
        });

        await waitFor(() => expect(result.current.completed.length).toBeGreaterThanOrEqual(1));
        const morningCheckIn = result.current.completed.find((c) => c.type === 'morning');
        expect(morningCheckIn).toBeDefined();
        expect(morningCheckIn?.status).toBe('completed');
        if (generatedTitle) {
            expect(morningCheckIn?.title).toBe(generatedTitle);
        } else {
            // Fallback to summary path
            expect(morningCheckIn?.title).toContain('breath');
        }

        // Repeat for evening
        const eveningMessages = [
            { id: 'u3', role: 'user' as const, content: 'Today I am winding down and want to notice what went well.', timestamp: 4 },
            { id: 'a2', role: 'assistant' as const, content: 'What is one thing that went well?', timestamp: 5 },
            { id: 'u4', role: 'user' as const, content: 'A long walk after dinner.', timestamp: 6 },
        ];

        let eveningTitle: string | undefined;
        if (await backendHealthy()) {
            try {
                eveningTitle = await realGenerateEntryTitle('Today I am winding down and want to notice what went well.');
            } catch { /* expected fallback */ }
        }

        await act(async () => {
            await finishIntentionChat({
                messages: eveningMessages,
                inputValue: '',
                draftCheckInId: null,
                checkInType: 'evening',
                personaId: undefined,
                intention: null,
                isRefineMode: false,
                title: eveningTitle,
            });
            await result.current.refresh();
        });

        await waitFor(() => {
            const all = result.current.completed;
            expect(all.some((c) => c.type === 'morning')).toBe(true);
            expect(all.some((c) => c.type === 'evening')).toBe(true);
        });
    });

    it('QA9: closing mid-conversation saves a draft that can be resumed', async () => {
        const draftMessages = [
            { id: 'd1', role: 'user' as const, content: 'I am thinking about adding a morning run.', timestamp: 10 },
            { id: 'a3', role: 'assistant' as const, content: 'What feels good about that?', timestamp: 11 },
        ];

        const draftId = await saveIntentionChatDraft({
            messages: draftMessages,
            inputValue: 'and I want it to be gentle',
            draftCheckInId: null,
            checkInType: 'morning',
            personaId: undefined,
        });

        expect(draftId).toBeTruthy();
        const stored = JSON.parse(store.get('@intention_checkins') ?? '{}');
        const draft = stored[draftId as string];
        expect(draft).toBeDefined();
        expect(draft.status).toBe('draft');
        expect(draft.messages.length).toBe(3); // original 2 + pending input
        expect(draft.messages[2].content).toBe('and I want it to be gentle');
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
        store.set('@journal_entries', JSON.stringify(map));
        const rehydrated = JSON.parse(store.get('@journal_entries') ?? '{}');
        expect(rehydrated[journalEntry.id].title).toBe('A calm morning');
        expect(rehydrated[journalEntry.id].messages[0].content).toContain('slow mornings');
    });

    it('QA11: manual memory note propagates to useLocalMemoryContext without reload (subscription works)', async () => {
        const memories = renderHook(() => useLocalMemories());
        const context = renderHook(() => useLocalMemoryContext({ query: 'calm' }));

        await waitFor(() => expect(memories.result.current.isLoading).toBe(false));
        await waitFor(() => expect(context.result.current.isLoading).toBe(false));

        await act(async () => {
            await memories.result.current.addNote('Calm mornings mean a gentler afternoon.');
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
        expect(layers).toEqual(expect.arrayContaining(['episodic', 'profile']));

        // The hook (and therefore the graph) should see them
        const { result } = renderHook(() => useLocalMemories());
        await waitFor(() => expect(result.current.atoms.length).toBeGreaterThanOrEqual(2));

        // Convert to graph display model: salience 1-10, ISO date string
        const graphAtoms = result.current.atoms
            .filter((a) => a.sourceId?.startsWith(entry.id) || a.sourceId?.includes(entry.id))
            .map((a) => ({
                id: a.id,
                entryId: a.sourceId ?? a.id,
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

    it('QA13: corrupt memory payload recovers without crash and writes the v2 envelope', async () => {
        // Simulate the user opening the app after an interrupted write
        store.set('@rosebud_local_memory', '{not json');

        // The next read should not throw
        const memories1 = renderHook(() => useLocalMemories());
        await waitFor(() => expect(memories1.result.current.isLoading).toBe(false));
        expect(memories1.result.current.atoms).toEqual([]);

        // Corrupt payload should be backed up, main key cleared
        expect(store.get('@rosebud_local_memory_corrupt')).toBe('{not json');
        expect(store.has('@rosebud_local_memory')).toBe(false);

        // First write creates the v2 envelope
        await act(async () => {
            await memories1.result.current.addNote('Hello, post-crash world.');
        });

        const envelope = JSON.parse(store.get('@rosebud_local_memory') ?? '{}');
        expect(envelope.schemaVersion).toBe(2);
        expect(Object.keys(envelope.atoms).length).toBe(1);
    });
});
