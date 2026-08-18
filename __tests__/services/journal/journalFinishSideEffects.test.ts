/* eslint-disable import/first */

jest.mock('../../../services/memory/dayDigestStorage', () => ({
    upsertJournalDayDigest: jest.fn(async () => undefined),
}));
jest.mock('../../../services/memory/identityExtraction', () => ({
    extractIdentityFromSessionTranscript: jest.fn(async () => undefined),
}));
jest.mock('../../../services/memory/localMemory', () => ({
    saveJournalEntryMemories: jest.fn(async () => undefined),
}));
jest.mock('../../../services/memory/sessionDigestBuild', () => ({
    buildAndSaveSessionDigest: jest.fn(async () => undefined),
}));
jest.mock('../../../services/memory/hindsight/hindsightRetain', () => ({
    retainJournalEntryToHindsight: jest.fn(async () => true),
}));

import { runJournalFinishSideEffects } from '../../../services/journal/journalFinishSideEffects';
import { retainJournalEntryToHindsight } from '../../../services/memory/hindsight/hindsightRetain';
import type { JournalEntry } from '../../../services/journal/journalStorage.types';

const mockedRetain = retainJournalEntryToHindsight as jest.MockedFunction<
    typeof retainJournalEntryToHindsight
>;

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
    return {
        id: 'e1',
        title: 'Scarf from Grandma',
        emoji: '🧣',
        messages: [{
            id: 'm1',
            role: 'user',
            content: 'I got a lilac scarf from Grandma today.',
            timestamp: 1000,
        }],
        status: 'completed',
        createdAt: 1000,
        updatedAt: 1000,
        ...overrides,
    };
}

describe('runJournalFinishSideEffects', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('dispatches a background hindsight retain without blocking', async () => {
        const savedEntry = entry();
        await runJournalFinishSideEffects(savedEntry);
        expect(mockedRetain).toHaveBeenCalledWith(savedEntry);
    });

    it('does not await the retain attempt (fire-and-forget)', async () => {
        mockedRetain.mockReturnValueOnce(
            new Promise(() => undefined) // never settles — would hang if awaited
        );
        await expect(runJournalFinishSideEffects(entry())).resolves.toBeUndefined();
        expect(mockedRetain).toHaveBeenCalledTimes(1);
    });

    it('still retains when an earlier side effect fails', async () => {
        const { saveJournalEntryMemories } = jest.requireMock('../../../services/memory/localMemory') as {
            saveJournalEntryMemories: jest.Mock;
        };
        saveJournalEntryMemories.mockRejectedValueOnce(new Error('boom'));
        await expect(runJournalFinishSideEffects(entry())).resolves.toBeUndefined();
        expect(mockedRetain).toHaveBeenCalledTimes(1);
    });
});
