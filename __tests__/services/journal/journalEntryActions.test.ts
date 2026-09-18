/* eslint-disable import/first */

jest.mock('../../../services/memory/dayDigestStorage', () => ({
    upsertJournalDayDigest: jest.fn(async () => null),
    removeDayDigestSource: jest.fn(async () => 1),
}));
jest.mock('../../../services/memory/localMemory', () => ({
    saveJournalEntryMemories: jest.fn(async () => []),
    deleteMemoryAtomsByRootSource: jest.fn(async () => 2),
}));
jest.mock('../../../services/memory/memoryFiles', () => ({
    deleteMemoryFilesBySourceSessions: jest.fn(async () => 1),
}));
jest.mock('../../../services/memory/sessionDigestStorage', () => ({
    deleteSessionDigest: jest.fn(async () => true),
}));
jest.mock('../../../services/journal/journalStorage', () => ({
    getEntry: jest.fn(),
    updateEntry: jest.fn(),
    deleteEntry: jest.fn(),
}));

import {
    deleteJournalEntryWithTombstone,
    updateJournalEntryText,
} from '../../../services/journal/journalEntryActions';
import {
    removeDayDigestSource,
    upsertJournalDayDigest,
} from '../../../services/memory/dayDigestStorage';
import {
    deleteMemoryAtomsByRootSource,
    saveJournalEntryMemories,
} from '../../../services/memory/localMemory';
import { deleteMemoryFilesBySourceSessions } from '../../../services/memory/memoryFiles';
import { deleteSessionDigest } from '../../../services/memory/sessionDigestStorage';
import { deleteEntry, getEntry, updateEntry } from '../../../services/journal/journalStorage';
import type { JournalEntry } from '../../../services/journal/journalStorage.types';

const mockedGetEntry = getEntry as jest.MockedFunction<typeof getEntry>;
const mockedUpdateEntry = updateEntry as jest.MockedFunction<typeof updateEntry>;
const mockedDeleteEntry = deleteEntry as jest.MockedFunction<typeof deleteEntry>;
const mockedDeleteSessionDigest = deleteSessionDigest as jest.MockedFunction<typeof deleteSessionDigest>;
const mockedDeleteFiles = deleteMemoryFilesBySourceSessions as jest.MockedFunction<
    typeof deleteMemoryFilesBySourceSessions
>;
const mockedDeleteAtoms = deleteMemoryAtomsByRootSource as jest.MockedFunction<
    typeof deleteMemoryAtomsByRootSource
>;
const mockedRemoveDaySource = removeDayDigestSource as jest.MockedFunction<typeof removeDayDigestSource>;
const mockedSaveMemories = saveJournalEntryMemories as jest.MockedFunction<typeof saveJournalEntryMemories>;
const mockedUpsertDigest = upsertJournalDayDigest as jest.MockedFunction<typeof upsertJournalDayDigest>;

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
    return {
        id: 'entry-1',
        title: 'Kiln notes',
        emoji: '🔥',
        messages: [
            { id: 'm1', role: 'user', content: 'The kiln cooled overnight.', timestamp: 1000 },
            { id: 'm2', role: 'assistant', content: 'How did that feel?', timestamp: 1001 },
            { id: 'm3', role: 'user', content: 'Quiet, actually.', timestamp: 1002 },
        ],
        status: 'completed',
        createdAt: 1000,
        updatedAt: 1000,
        ...overrides,
    };
}

describe('deleteJournalEntryWithTombstone', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedDeleteEntry.mockResolvedValue(true);
        mockedDeleteSessionDigest.mockResolvedValue(true);
    });

    it('retires every derived artifact before dropping the entry', async () => {
        const order: string[] = [];
        mockedDeleteSessionDigest.mockImplementation(async () => {
            order.push('session-digest');
            return true;
        });
        mockedDeleteFiles.mockImplementation(async () => {
            order.push('memory-files');
            return 1;
        });
        mockedDeleteAtoms.mockImplementation(async () => {
            order.push('atoms');
            return 2;
        });
        mockedRemoveDaySource.mockImplementation(async () => {
            order.push('day-digest');
            return 1;
        });
        mockedDeleteEntry.mockImplementation(async () => {
            order.push('entry');
            return true;
        });

        await expect(deleteJournalEntryWithTombstone('entry-1')).resolves.toBe(true);

        expect(order).toEqual(['session-digest', 'memory-files', 'atoms', 'day-digest', 'entry']);
        expect(mockedDeleteSessionDigest).toHaveBeenCalledWith('entry-1');
        expect(mockedDeleteFiles).toHaveBeenCalledWith(['entry-1']);
        expect(mockedDeleteAtoms).toHaveBeenCalledWith('entry-1');
        expect(mockedRemoveDaySource).toHaveBeenCalledWith('journal_entry', 'entry-1');
    });

    it('still deletes the entry when a derived-artifact step fails', async () => {
        mockedDeleteSessionDigest.mockRejectedValue(new Error('digest store unavailable'));

        await expect(deleteJournalEntryWithTombstone('entry-1')).resolves.toBe(true);
        expect(mockedDeleteEntry).toHaveBeenCalledWith('entry-1');
        expect(mockedDeleteAtoms).toHaveBeenCalledWith('entry-1');
    });

    it('reports false when the entry row itself is gone', async () => {
        mockedDeleteEntry.mockResolvedValue(false);
        await expect(deleteJournalEntryWithTombstone('entry-1')).resolves.toBe(false);
    });
});

describe('updateJournalEntryText', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetEntry.mockResolvedValue(entry());
        mockedUpsertDigest.mockResolvedValue(null);
        mockedSaveMemories.mockResolvedValue([]);
    });

    it('persists the edited body as one authored turn and refreshes artifacts', async () => {
        const stored = entry({
            messages: [
                { id: 'm1', role: 'user', content: 'Edited body.', timestamp: 1000 },
                { id: 'm2', role: 'assistant', content: 'How did that feel?', timestamp: 1001 },
            ],
        });
        mockedUpdateEntry.mockResolvedValue(stored);

        await expect(updateJournalEntryText('entry-1', 'Edited body.')).resolves.toEqual(stored);

        const [id, input] = mockedUpdateEntry.mock.calls[0];
        expect(id).toBe('entry-1');
        expect(input.messages).toEqual([
            { id: 'm1', role: 'user', content: 'Edited body.', timestamp: 1000 },
            { id: 'm2', role: 'assistant', content: 'How did that feel?', timestamp: 1001 },
        ]);
        expect(mockedSaveMemories).toHaveBeenCalledWith(stored);
        expect(mockedUpsertDigest).toHaveBeenCalledWith(stored);
    });

    it('keeps the edit when a derived-artifact refresh fails', async () => {
        mockedUpdateEntry.mockResolvedValue(entry());
        mockedSaveMemories.mockRejectedValue(new Error('extraction offline'));

        await expect(updateJournalEntryText('entry-1', 'New text')).resolves.not.toBeNull();
        expect(mockedUpsertDigest).toHaveBeenCalled();
    });

    it('does not write when the entry is missing', async () => {
        mockedGetEntry.mockResolvedValue(null);
        await expect(updateJournalEntryText('gone', 'text')).resolves.toBeNull();
        expect(mockedUpdateEntry).not.toHaveBeenCalled();
    });
});
