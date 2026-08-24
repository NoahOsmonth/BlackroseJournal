/* eslint-disable import/first */

jest.mock('../../../services/ai/aiTransport', () => ({
    fetchAiChatCompletion: jest.fn(),
}));

import { fetchAiChatCompletion } from '../../../services/ai/aiTransport';
import { resetJsonCompletionStateForTests } from '../../../services/ai/jsonCompletion';
import {
    extractCheckInMemoryAtoms,
    extractJournalMemoryAtoms,
} from '../../../services/memory/memoryAtomExtraction';
import type { JournalEntry } from '../../../services/journal/journalStorage.types';
import type { IntentionCheckIn } from '../../../services/intentions/intentionsStorage.types';

const mockFetch = jest.mocked(fetchAiChatCompletion);

function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    } as Response;
}

const journal: JournalEntry = {
    id: 'entry_ai',
    title: 'Walk after work',
    emoji: '🚶',
    messages: [{
        id: 'u1',
        role: 'user',
        content: 'I walked after work and felt the career pressure ease.',
        timestamp: 1,
    }],
    analysis: {
        insight: 'Movement softens work stress.',
        quote: 'Walk it off',
        mood: 'Calm',
        topics: ['walking', 'career'],
        generatedAt: 1,
    },
    createdAt: 1,
    updatedAt: 1,
    status: 'completed',
};

describe('memoryAtomExtraction', () => {
    beforeEach(() => {
        resetJsonCompletionStateForTests();
    });

    afterEach(() => {
        jest.clearAllMocks();
        resetJsonCompletionStateForTests();
    });

    it('maps AI atoms into mergeable journal memory inputs', async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({
            choices: [{
                message: {
                    content: JSON.stringify({
                        atoms: [
                            {
                                layer: 'episodic',
                                title: 'Evening walk released pressure',
                                content: 'After work you walked and felt career stress loosen.',
                                tags: ['walk', 'career'],
                                salience: 0.8,
                                confidence: 0.9,
                                mergeKey: 'session',
                            },
                            {
                                layer: 'semantic',
                                title: 'Movement eases work stress',
                                content: 'Walking is a reliable way you downshift from career pressure.',
                                tags: ['walking', 'stress'],
                                salience: 0.65,
                                confidence: 0.8,
                                mergeKey: 'movement_work',
                            },
                        ],
                    }),
                },
            }],
        }));

        const atoms = await extractJournalMemoryAtoms(journal);
        expect(atoms).toHaveLength(2);
        expect(atoms[0]).toMatchObject({
            layer: 'episodic',
            source: 'journal',
            sourceId: 'entry_ai',
            rootSourceId: 'entry_ai',
            rootSourceKind: 'journal_entry',
        });
        expect(atoms[1]).toMatchObject({
            layer: 'semantic',
            sourceId: 'theme:movement-work',
        });
        expect(atoms.every((a) => !/drawn from|system synthesis|memoryies/i.test(a.content))).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
            expect.objectContaining({ response_format: { type: 'json_object' } }),
            expect.objectContaining({ modelPurpose: 'flash' })
        );
    });

    it('soft-fails to empty list when the provider errors', async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'nope' }, 500));
        const atoms = await extractCheckInMemoryAtoms({
            id: 'c1',
            type: 'evening',
            title: 'Evening',
            summary: 'Tired but okay',
            mood: 'Soft',
            status: 'completed',
            messages: [{ id: 'm1', role: 'user', content: 'Long day.', timestamp: 1 }],
            createdAt: 1,
            updatedAt: 1,
        } as IntentionCheckIn);
        expect(atoms).toEqual([]);
    });

    /**
     * Routes through fetchDirectJsonCompletion: json_object 400 → freeform atoms.
     * Break by: not wiring atom extract through the shared helper.
     */
    it('extracts atoms via freeform when json_object is rejected (400)', async () => {
        const rejectBody = JSON.stringify({
            error: { message: "does not support 'json_object' response format", code: 400 },
        });
        mockFetch
            .mockResolvedValueOnce({
                ok: false,
                status: 400,
                text: async () => rejectBody,
                json: async () => JSON.parse(rejectBody),
            } as Response)
            .mockResolvedValueOnce(jsonResponse({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            atoms: [{
                                layer: 'episodic',
                                title: 'Evening walk released pressure',
                                content: 'After work you walked and felt career stress loosen.',
                                tags: ['walk', 'career'],
                                salience: 0.8,
                                confidence: 0.9,
                                mergeKey: 'session',
                            }],
                        }),
                    },
                }],
            }));

        const atoms = await extractJournalMemoryAtoms(journal);
        expect(atoms).toHaveLength(1);
        expect(atoms[0].title).toContain('walk');
        expect(mockFetch.mock.calls[0][0].response_format).toEqual({ type: 'json_object' });
        expect(mockFetch.mock.calls[1][0].response_format).toBeUndefined();
    });
});
