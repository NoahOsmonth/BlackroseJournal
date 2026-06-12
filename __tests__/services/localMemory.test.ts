/* eslint-disable import/first */

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

import {
    buildLocalMemoryContext,
    clearMemoryAtoms,
    generateMemoryNoteSuggestion,
    listMemoryAtoms,
    resetMemoryStorageAdapter,
    deleteMemoryAtom,
    saveGeneratedMemoryNote,
    saveManualMemoryNote,
    saveIntentionCheckInMemories,
    saveJournalEntryMemories,
    setMemoryStorageAdapter,
} from '../../services/memory/localMemory';
import type {
    JournalEntry,
    StorageAdapter,
} from '../../services/journal/journalStorage.types';
import type { IntentionCheckIn } from '../../services/intentions/intentionsStorage.types';

function createMemoryAdapter(): StorageAdapter {
    const store = new Map<string, string>();
    return {
        getItem: (key) => Promise.resolve(store.get(key) ?? null),
        setItem: (key, value) => {
            store.set(key, value);
            return Promise.resolve();
        },
        removeItem: (key) => {
            store.delete(key);
            return Promise.resolve();
        },
    };
}

function buildEntry(status: JournalEntry['status'] = 'completed'): JournalEntry {
    return {
        id: 'entry-1',
        title: 'Career pressure and rest',
        emoji: '📝',
        status,
        createdAt: 1_800_000,
        updatedAt: 1_800_000,
        messages: [{
            id: 'message-1',
            role: 'user',
            content: 'I felt career pressure today and wanted a slower evening.',
            timestamp: 1_800_000,
        }],
        analysis: {
            insight: 'The user is balancing ambition with recovery.',
            quote: 'Rest can hold ambition without dropping it.',
            mood: 'Tired but hopeful',
            topics: ['Career', 'Rest'],
            generatedAt: 1_800_100,
        },
    };
}

function buildCheckIn(
    type: IntentionCheckIn['type'] = 'morning',
    status: IntentionCheckIn['status'] = 'completed'
): IntentionCheckIn {
    return {
        id: 'checkin-1',
        type,
        title: 'Start the day with focus',
        summary: 'I want to stay focused and avoid distractions today.',
        mood: 'Reflective',
        status,
        createdAt: 1_800_000,
        updatedAt: 1_800_000,
        messages: [{
            id: 'message-1',
            role: 'user',
            content: 'I want to stay focused and avoid distractions today.',
            timestamp: 1_800_000,
        }],
    };
}

describe('localMemory', () => {
    beforeEach(() => {
        jest.spyOn(Date, 'now').mockReturnValue(1_900_000);
        setMemoryStorageAdapter(createMemoryAdapter());
    });

    afterEach(() => {
        jest.restoreAllMocks();
        resetMemoryStorageAdapter();
    });

    it('turns completed journal entries into layered local memories', async () => {
        await saveJournalEntryMemories(buildEntry());

        const atoms = await listMemoryAtoms();
        const layers = atoms.map((atom) => atom.layer);

        expect(layers).toEqual(expect.arrayContaining(['episodic', 'profile', 'semantic']));
        expect(atoms.some((atom) => atom.title === 'Theme: Career')).toBe(true);
    });

    it('builds a bounded prompt capsule and records retrieval access', async () => {
        await saveJournalEntryMemories(buildEntry());

        const context = await buildLocalMemoryContext({ query: 'career recovery', limit: 3 });
        const atoms = await listMemoryAtoms();

        expect(context).toContain('## Local Memory Capsule');
        expect(context).toContain('Career');
        expect(atoms.some((atom) => atom.accessCount > 0)).toBe(true);
    });

    it('does not save unfinished drafts as long-term memory', async () => {
        await saveJournalEntryMemories(buildEntry('draft'));

        await expect(listMemoryAtoms()).resolves.toEqual([]);
        await clearMemoryAtoms();
    });

    it('saves and deletes manual note memories', async () => {
        const note = await saveManualMemoryNote('Remember that evenings should stay gentle.');

        expect(note.layer).toBe('note');
        expect(note.source).toBe('manual');
        await expect(deleteMemoryAtom(note.id)).resolves.toBe(true);
        await expect(listMemoryAtoms()).resolves.toEqual([]);
    });

    it('generates a warm therapist-voice suggested note from non-note memory atoms', async () => {
        await saveJournalEntryMemories(buildEntry());

        const suggestion = generateMemoryNoteSuggestion(await listMemoryAtoms());

        expect(suggestion).toContain('You seem to be someone who is navigating a lot right now');
        expect(suggestion).toContain('Rosebud notices you often return to themes of');
        expect(suggestion).toContain('It may help to remember that');
        expect(suggestion).toContain('balancing ambition with recovery');
        expect(suggestion).toContain('career');
        expect(suggestion).not.toContain('Remember for Rosebud chats');
    });

    it('saves generated settings notes as system note atoms', async () => {
        const note = await saveGeneratedMemoryNote('Remember to support gentler evenings.');

        expect(note.layer).toBe('note');
        expect(note.source).toBe('system');
        expect(note.salience).toBeGreaterThan(0.7);
    });

    it('turns completed intention check-ins into source:intention memories', async () => {
        await saveIntentionCheckInMemories(buildCheckIn());

        const atoms = await listMemoryAtoms();
        const sources = atoms.map((atom) => atom.source);
        const layers = atoms.map((atom) => atom.layer);

        expect(sources).toEqual(['intention', 'intention']);
        expect(layers).toEqual(expect.arrayContaining(['episodic', 'profile']));
        expect(atoms.some((atom) => atom.title === 'Morning intention: Start the day with focus'))
            .toBe(true);
        expect(atoms.some((atom) => atom.layer === 'profile' && atom.content.includes('pattern')))
            .toBe(true);
    });

    it('does not save unfinished intention check-ins as long-term memory', async () => {
        await saveIntentionCheckInMemories(buildCheckIn('evening', 'draft'));

        await expect(listMemoryAtoms()).resolves.toEqual([]);
    });

    it('includes intention memories in local memory context', async () => {
        await saveIntentionCheckInMemories(buildCheckIn('intention'));

        const context = await buildLocalMemoryContext({ query: 'focused distractions', limit: 3 });

        expect(context).toContain('## Local Memory Capsule');
        expect(context).toContain('focused');
        expect(context).toContain('Intention:');
    });
});
