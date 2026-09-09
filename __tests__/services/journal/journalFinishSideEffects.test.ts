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
jest.mock('../../../services/ai', () => ({
    generateEntryAnalysis: jest.fn(async () => ({
        insight: 'insight',
        quote: 'quote',
        mood: 'Reflective',
        topics: ['Self-awareness'],
    })),
}));
jest.mock('../../../services/journal/journalStorage', () => ({
    updateEntry: jest.fn(async () => undefined),
}));

import {
    clearFinishBackground,
    getFinishBackgroundStatus,
} from '../../../services/journal/finishBackgroundStore';
import { runJournalFinishBackground, runJournalFinishSideEffects } from '../../../services/journal/journalFinishSideEffects';
import type { JournalEntry } from '../../../services/journal/journalStorage.types';
import { retainJournalEntryToHindsight } from '../../../services/memory/hindsight/hindsightRetain';

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

describe('runJournalFinishBackground', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearFinishBackground();
    });

    afterEach(() => {
        clearFinishBackground();
    });

    it('runs all steps in parallel and settles every step in the store', async () => {
        const savedEntry = entry();
        const { promise } = runJournalFinishBackground(savedEntry);

        await expect(promise).resolves.toBeUndefined();

        const status = getFinishBackgroundStatus();
        expect(status?.entryId).toBe('e1');
        expect(status?.done).toEqual({
            analysis: true,
            memories: true,
            digest: true,
            identity: true,
            sessionDigest: true,
            hindsight: true,
        });
    });

    it('never rejects when a step fails and records the error', async () => {
        const { saveJournalEntryMemories } = jest.requireMock('../../../services/memory/localMemory') as {
            saveJournalEntryMemories: jest.Mock;
        };
        saveJournalEntryMemories.mockRejectedValueOnce(new Error('boom'));

        const { promise } = runJournalFinishBackground(entry());
        await expect(promise).resolves.toBeUndefined();

        const status = getFinishBackgroundStatus();
        expect(status?.done.memories).toBe(true);
        expect(status?.error).toBe('boom');
        // Other steps still ran.
        expect(status?.done.analysis).toBe(true);
        expect(status?.done.digest).toBe(true);
    });

    it('still attempts every step when one rejects (parallel, not sequential)', async () => {
        const { saveJournalEntryMemories } = jest.requireMock('../../../services/memory/localMemory') as {
            saveJournalEntryMemories: jest.Mock;
        };
        const { upsertJournalDayDigest } = jest.requireMock('../../../services/memory/dayDigestStorage') as {
            upsertJournalDayDigest: jest.Mock;
        };
        const { extractIdentityFromSessionTranscript } = jest.requireMock('../../../services/memory/identityExtraction') as {
            extractIdentityFromSessionTranscript: jest.Mock;
        };
        const { buildAndSaveSessionDigest } = jest.requireMock('../../../services/memory/sessionDigestBuild') as {
            buildAndSaveSessionDigest: jest.Mock;
        };
        saveJournalEntryMemories.mockRejectedValueOnce(new Error('boom'));

        const { promise } = runJournalFinishBackground(entry());
        await expect(promise).resolves.toBeUndefined();

        expect(upsertJournalDayDigest).toHaveBeenCalledTimes(1);
        expect(extractIdentityFromSessionTranscript).toHaveBeenCalledTimes(1);
        expect(buildAndSaveSessionDigest).toHaveBeenCalledTimes(1);
        expect(mockedRetain).toHaveBeenCalledTimes(1);
    });

    it('persists the generated analysis onto the saved entry', async () => {
        const { updateEntry } = jest.requireMock('../../../services/journal/journalStorage') as {
            updateEntry: jest.Mock;
        };
        const savedEntry = entry();

        const { promise } = runJournalFinishBackground(savedEntry);
        await expect(promise).resolves.toBeUndefined();

        expect(updateEntry).toHaveBeenCalledWith('e1', {
            analysis: expect.objectContaining({
                insight: 'insight',
                quote: 'quote',
                mood: 'Reflective',
                topics: ['Self-awareness'],
                generatedAt: expect.any(Number),
            }),
        });
    });

    it('skips analysis for an empty entry but still settles the step', async () => {
        const { generateEntryAnalysis } = jest.requireMock('../../../services/ai') as {
            generateEntryAnalysis: jest.Mock;
        };
        const savedEntry = entry({ messages: [] });

        const { promise } = runJournalFinishBackground(savedEntry);
        await expect(promise).resolves.toBeUndefined();

        expect(generateEntryAnalysis).not.toHaveBeenCalled();
        expect(getFinishBackgroundStatus()?.done.analysis).toBe(true);
    });
});
