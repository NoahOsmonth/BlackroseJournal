/* eslint-disable import/first */

jest.mock('../../../services/ai/directTransport', () => ({
    fetchDirectChatCompletion: jest.fn(),
    getDirectConfig: jest.fn(),
}));

import {
    fetchDirectChatCompletion,
} from '../../../services/ai/directTransport';
import { synthesizeMemoryInsight } from '../../../services/memory/memoryInsightService';
import type { MemoryGraphAtom } from '../../../services/memory/memoryGraph.types';

const mockFetchDirectChatCompletion = jest.mocked(fetchDirectChatCompletion);

const atom: MemoryGraphAtom = {
    id: 'atom-1',
    entryId: 'entry-1',
    source: 'journal',
    title: 'Career pressure',
    content: 'The user wants recovery after career pressure.',
    layer: 'profile',
    salience: 8,
    confidence: 0.8,
    tags: ['career', 'rest'],
    createdAt: '2026-01-01T00:00:00.000Z',
};

describe('memoryInsightService', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('requests a glance synthesis without meta template language', async () => {
        mockFetchDirectChatCompletion.mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: 'Career still hums under the rest you crave.' } }],
            }),
        } as Response);

        const result = await synthesizeMemoryInsight(atom, {
            mode: 'glance',
            relatedTitles: ['Slow mornings'],
        });

        expect(result).toBe('Career still hums under the rest you crave.');
        expect(mockFetchDirectChatCompletion).toHaveBeenCalledWith(
            expect.objectContaining({
                model: 'agent-default',
                messages: expect.arrayContaining([
                    expect.objectContaining({
                        role: 'system',
                        content: expect.stringContaining('At a glance'),
                    }),
                    expect.objectContaining({
                        role: 'user',
                        content: expect.stringContaining('Career pressure'),
                    }),
                ]),
            }),
            expect.objectContaining({ modelPurpose: 'flash' })
        );
        const system = (mockFetchDirectChatCompletion.mock.calls[0][0] as {
            messages: { content: string }[];
        }).messages[0].content;
        expect(system.toLowerCase()).toContain('never use meta');
        expect(system).toMatch(/Do not start with "This is"/i);
    });

    it('throws when the direct AI response is not usable', async () => {
        mockFetchDirectChatCompletion.mockResolvedValue({
            ok: false,
            statusText: 'Unauthorized',
        } as Response);

        await expect(synthesizeMemoryInsight(atom)).rejects.toThrow(
            'Memory insight request failed: Unauthorized'
        );
    });
});
