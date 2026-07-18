/* eslint-disable import/first */

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

// Exercise deterministic fallback path (AI extract returns nothing).
jest.mock('@/services/memory/memoryAtomExtraction', () => ({
    extractJournalMemoryAtoms: jest.fn(async () => []),
    extractCheckInMemoryAtoms: jest.fn(async () => []),
}));

jest.mock('@/services/ai/embeddingsTransport', () => ({
    embedText: jest.fn(async () => null),
}));

import {
    clearMemoryAtoms,
    listMemoryAtoms,
    resetMemoryStorageAdapter,
    saveIntentionCheckInMemories,
    saveJournalEntryMemories,
    setMemoryStorageAdapter,
} from '@/services/memory/localMemory';
import {
    extractCheckInMemoryAtoms,
    extractJournalMemoryAtoms,
} from '@/services/memory/memoryAtomExtraction';
import type { JournalEntry } from '@/services/journal/journalStorage.types';
import type { IntentionCheckIn } from '@/services/intentions/intentionsStorage.types';

interface InMemoryAdapter {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
    store: Map<string, string>;
}

function createInMemoryAdapter(): InMemoryAdapter {
    const store = new Map<string, string>();
    return {
        store,
        async getItem(key: string) {
            return store.get(key) ?? null;
        },
        async setItem(key: string, value: string) {
            store.set(key, value);
        },
        async removeItem(key: string) {
            store.delete(key);
        },
    };
}

function journal(overrides: Partial<JournalEntry> = {}): JournalEntry {
    return {
        id: overrides.id ?? 'entry_a',
        title: overrides.title ?? 'Reflection',
        emoji: '🚶',
        messages: overrides.messages ?? [{
            id: 'u1',
            role: 'user',
            content: 'I had a good walk today and felt grounded after work stress.',
            timestamp: 1_700_000_000_000,
        }],
        analysis: overrides.analysis ?? {
            insight: 'Walking brings calm after career pressure.',
            quote: 'A simple walk grounds me.',
            mood: 'Calm',
            topics: ['walking', 'calm', 'career'],
            generatedAt: 1_700_000_000_000,
        },
        createdAt: overrides.createdAt ?? 1_700_000_000_000,
        updatedAt: overrides.updatedAt ?? 1_700_000_000_000,
        status: overrides.status ?? 'completed',
    };
}

describe('journal / check-in atom pipeline', () => {
    beforeEach(async () => {
        setMemoryStorageAdapter(createInMemoryAdapter());
        await clearMemoryAtoms();
        jest.mocked(extractJournalMemoryAtoms).mockResolvedValue([]);
        jest.mocked(extractCheckInMemoryAtoms).mockResolvedValue([]);
    });

    afterEach(() => {
        resetMemoryStorageAdapter();
        jest.clearAllMocks();
    });

    it('creates one episodic, merged themes, and a named profile — never About the user', async () => {
        const atoms = await saveJournalEntryMemories(journal());

        expect(atoms.length).toBeLessThanOrEqual(5);
        expect(atoms.some((atom) => atom.layer === 'episodic')).toBe(true);
        expect(atoms.filter((atom) => atom.layer === 'semantic').length).toBeLessThanOrEqual(3);
        expect(atoms.every((atom) => atom.title.toLowerCase() !== 'about the user')).toBe(true);
        expect(atoms.every((atom) => atom.rootSourceId === 'entry_a')).toBe(true);
        expect(atoms.every((atom) => atom.rootSourceKind === 'journal_entry')).toBe(true);
    });

    it('persists AI-extracted atoms when the model returns them', async () => {
        jest.mocked(extractJournalMemoryAtoms).mockResolvedValueOnce([
            {
                layer: 'episodic',
                source: 'journal',
                sourceId: 'entry_a',
                rootSourceId: 'entry_a',
                rootSourceKind: 'journal_entry',
                title: 'Grounded after the walk',
                content: 'A walk after work helped you feel grounded again.',
                tags: ['walk', 'grounded'],
                salience: 0.8,
                confidence: 0.9,
            },
        ]);

        const atoms = await saveJournalEntryMemories(journal());
        expect(atoms).toHaveLength(1);
        expect(atoms[0]?.title).toBe('Grounded after the walk');
        expect(atoms[0]?.content).not.toMatch(/drawn from|Recurring theme:/i);
    });

    it('merges the same theme across two journal entries into one semantic node', async () => {
        await saveJournalEntryMemories(journal({ id: 'entry_a' }));
        await saveJournalEntryMemories(journal({
            id: 'entry_b',
            title: 'Another walk',
            analysis: {
                insight: 'Walking still helps.',
                quote: 'Walk',
                mood: 'Steady',
                topics: ['walking', 'calm'],
                generatedAt: 1_700_000_100_000,
            },
        }));

        const all = await listMemoryAtoms();
        const walkingThemes = all.filter(
            (atom) => atom.layer === 'semantic' && atom.sourceId === 'theme:walking'
        );
        expect(walkingThemes).toHaveLength(1);
        expect(walkingThemes[0]?.rootSourceId).toBe('entry_b');
    });

    it('saves check-ins as episodic with provenance and no About the user', async () => {
        const checkIn: IntentionCheckIn = {
            id: 'check_1',
            intentionId: 'int_1',
            type: 'morning',
            title: 'Morning intention',
            summary: 'No phone',
            mood: 'Calm',
            status: 'completed',
            messages: [{
                id: 'm1',
                role: 'user',
                content: 'Short note',
                timestamp: 1,
            }],
            createdAt: 1,
            updatedAt: 1,
        };

        const atoms = await saveIntentionCheckInMemories(checkIn);
        expect(atoms).toHaveLength(1);
        expect(atoms[0]?.layer).toBe('episodic');
        expect(atoms[0]?.rootSourceId).toBe('check_1');
        expect(atoms[0]?.rootSourceKind).toBe('intention_checkin');
        expect(atoms[0]?.title.toLowerCase()).not.toBe('about the user');
    });
});
