/* eslint-disable import/first */

jest.mock('../../../services/journal/journalStorage', () => ({
    getEntry: jest.fn(),
}));

jest.mock('../../../services/intentions/intentionsStorage', () => ({
    getCheckIn: jest.fn(),
    getIntention: jest.fn(),
}));

import { getEntry } from '../../../services/journal/journalStorage';
import { getCheckIn, getIntention } from '../../../services/intentions/intentionsStorage';
import { resolveMemorySource } from '../../../services/memory/memorySourceResolver';
import type { MemoryGraphAtom } from '../../../services/memory/memoryGraph.types';

const mockGetEntry = jest.mocked(getEntry);
const mockGetCheckIn = jest.mocked(getCheckIn);
const mockGetIntention = jest.mocked(getIntention);

function atom(overrides: Partial<MemoryGraphAtom> = {}): MemoryGraphAtom {
    return {
        id: 'journal:episodic:entry-1',
        entryId: 'entry-1',
        source: 'journal',
        sourceId: 'entry-1',
        rootSourceId: 'entry-1',
        rootSourceKind: 'journal_entry',
        title: 'Coffee',
        content: 'Calm morning',
        layer: 'episodic',
        salience: 7,
        confidence: 0.8,
        tags: ['morning'],
        createdAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
    };
}

describe('resolveMemorySource', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('resolves a journal entry preview', async () => {
        mockGetEntry.mockResolvedValue({
            id: 'entry-1',
            title: 'A slow morning with coffee',
            emoji: '☕',
            messages: [
                { id: 'm1', role: 'user', content: 'Woke up early with coffee.', timestamp: 1 },
                { id: 'm2', role: 'assistant', content: 'Nice.', timestamp: 2 },
            ],
            status: 'completed',
            analysis: {
                insight: 'x',
                quote: 'y',
                mood: 'Calm',
                topics: [],
                generatedAt: 1,
            },
            createdAt: Date.parse('2026-01-01T12:00:00.000Z'),
            updatedAt: Date.parse('2026-01-01T12:00:00.000Z'),
        });

        const preview = await resolveMemorySource(atom());

        expect(preview).toMatchObject({
            kind: 'journal_entry',
            id: 'entry-1',
            title: 'A slow morning with coffee',
            emoji: '☕',
            mood: 'Calm',
            messageCount: 2,
            snippet: expect.stringContaining('Woke up early'),
        });
    });

    it('resolves a check-in with intention title', async () => {
        mockGetCheckIn.mockResolvedValue({
            id: 'check-1',
            intentionId: 'int-1',
            type: 'morning',
            title: 'Morning intention',
            summary: 'No phone',
            mood: 'Hopeful',
            status: 'completed',
            messages: [
                { id: 'c1', role: 'user', content: 'No phone until breakfast.', timestamp: 1 },
            ],
            createdAt: 1_700_000_000_000,
            updatedAt: 1_700_000_000_000,
        });
        mockGetIntention.mockResolvedValue({
            id: 'int-1',
            title: 'Protect a calm morning',
            description: '',
            area: 'wellbeing',
            iconKey: 'sunny',
            createdAt: 1,
            updatedAt: 1,
        });

        const preview = await resolveMemorySource(atom({
            id: 'intention:episodic:check-1',
            source: 'intention',
            sourceId: 'check-1',
            rootSourceId: 'check-1',
            rootSourceKind: 'intention_checkin',
            layer: 'episodic',
        }));

        expect(preview).toMatchObject({
            kind: 'intention_checkin',
            id: 'check-1',
            intentionTitle: 'Protect a calm morning',
            messageCount: 1,
        });
    });

    it('returns null when journal entry is missing', async () => {
        mockGetEntry.mockResolvedValue(null);
        await expect(resolveMemorySource(atom())).resolves.toBeNull();
    });
});
