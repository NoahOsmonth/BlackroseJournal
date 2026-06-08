/* eslint-disable import/first */

jest.mock('../../../services/ai/directTransport', () => ({
    fetchDirectChatCompletion: jest.fn(),
    getDirectConfig: jest.fn(),
}));

import {
    fetchDirectChatCompletion,
    getDirectConfig,
} from '../../../services/ai/directTransport';
import { synthesizeMemoryInsight } from '../../../services/memory/memoryInsightService';
import type { LocalMemoryAtom } from '../../../services/memory/memoryGraph.types';

const mockFetchDirectChatCompletion = jest.mocked(fetchDirectChatCompletion);
const mockGetDirectConfig = jest.mocked(getDirectConfig);

const atom: LocalMemoryAtom = {
    id: 'atom-1',
    entryId: 'entry-1',
    title: 'Career pressure',
    content: 'The user wants recovery after career pressure.',
    layer: 'profile',
    salience: 8,
    confidence: 0.8,
    tags: ['career', 'rest'],
    createdAt: '2026-01-01T00:00:00.000Z',
};

describe('memoryInsightService', () => {
    beforeEach(() => {
        mockGetDirectConfig.mockReturnValue({
            apiKey: 'api-key',
            apiBaseUrl: 'https://nano-gpt.com/api/v1',
            model: 'moonshotai/kimi-k2.5:thinking',
            flashModel: 'moonshotai/kimi-k2.5',
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('requests a synthesis insight for a graph atom', async () => {
        mockFetchDirectChatCompletion.mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: 'A concise connection.' } }],
            }),
        } as Response);

        const result = await synthesizeMemoryInsight(atom);

        expect(result).toBe('A concise connection.');
        expect(mockFetchDirectChatCompletion).toHaveBeenCalledWith({
            model: 'moonshotai/kimi-k2.5:thinking',
            messages: expect.arrayContaining([
                expect.objectContaining({ role: 'system' }),
                expect.objectContaining({
                    role: 'user',
                    content: expect.stringContaining('Career pressure'),
                }),
            ]),
        });
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
