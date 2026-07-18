/* eslint-disable import/first */

import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('../../hooks/memory/useLocalMemories', () => ({
    useLocalMemories: jest.fn(),
}));

jest.mock('../../services/memory/memoryInsightService', () => ({
    synthesizeMemoryInsight: jest.fn(),
}));

import { useLocalMemories } from '../../hooks/memory/useLocalMemories';
import { useMemoryGraph } from '../../hooks/memory/useMemoryGraph';
import { synthesizeMemoryInsight } from '../../services/memory/memoryInsightService';
import type { LocalMemoryAtom } from '../../services/memory/localMemory.types';

const mockUseLocalMemories = jest.mocked(useLocalMemories);
const mockSynthesizeMemoryInsight = jest.mocked(synthesizeMemoryInsight);

function storedAtom(overrides: Partial<LocalMemoryAtom>): LocalMemoryAtom {
    return {
        id: 'atom-1',
        layer: 'episodic',
        source: 'journal',
        sourceId: 'entry-1',
        rootSourceId: 'entry-1',
        rootSourceKind: 'journal_entry',
        title: 'Career pressure',
        content: 'The user wants recovery after career pressure.',
        tags: ['career', 'rest'],
        salience: 0.7,
        confidence: 0.8,
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
        accessCount: 0,
        ...overrides,
    };
}

describe('useMemoryGraph', () => {
    beforeEach(() => {
        mockUseLocalMemories.mockReturnValue({
            atoms: [
                storedAtom({ id: 'atom-1', layer: 'episodic' }),
                storedAtom({
                    id: 'atom-2',
                    layer: 'profile',
                    title: 'Balances ambition with recovery',
                    tags: ['career', 'identity'],
                    rootSourceId: 'entry-1',
                }),
            ],
            isLoading: false,
            generatedNote: 'Remember for Rosebud chats: career recovery matters.',
            refresh: jest.fn(),
            addNote: jest.fn(),
            addGeneratedNote: jest.fn(),
            refreshGeneratedNote: jest.fn(),
            removeAtom: jest.fn(),
            clearAll: jest.fn(),
        });
        mockSynthesizeMemoryInsight.mockResolvedValue('A concise connection.');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('maps stored local memories into filtered graph atoms and connections', () => {
        const { result } = renderHook(() => useMemoryGraph());

        expect(result.current.atoms).toHaveLength(2);
        expect(result.current.atoms[0]).toMatchObject({
            id: 'atom-1',
            entryId: 'entry-1',
            rootSourceId: 'entry-1',
            source: 'journal',
            salience: 7,
        });
        // Same-root edge always; tags may also contribute.
        expect(result.current.connections.some(
            (edge) => edge.from === 'atom-1' && edge.to === 'atom-2'
        )).toBe(true);

        act(() => result.current.setSearchQuery('identity'));
        expect(result.current.atoms.map((atom) => atom.id)).toEqual(['atom-2']);
    });

    it('maps intention source atoms through to the graph display model', () => {
        mockUseLocalMemories.mockReturnValue({
            atoms: [
                storedAtom({
                    id: 'atom-3',
                    source: 'intention',
                    layer: 'episodic',
                    rootSourceKind: 'intention_checkin',
                }),
            ],
            isLoading: false,
            generatedNote: '',
            refresh: jest.fn(),
            addNote: jest.fn(),
            addGeneratedNote: jest.fn(),
            refreshGeneratedNote: jest.fn(),
            removeAtom: jest.fn(),
            clearAll: jest.fn(),
        });

        const { result } = renderHook(() => useMemoryGraph());

        expect(result.current.atoms).toHaveLength(1);
        expect(result.current.atoms[0]).toMatchObject({
            id: 'atom-3',
            source: 'intention',
            layer: 'episodic',
            rootSourceKind: 'intention_checkin',
        });
    });

    it('auto-generates AI at-a-glance on select and deepens on demand', async () => {
        mockSynthesizeMemoryInsight
            .mockResolvedValueOnce('Career recovery is still the quiet center of this week.')
            .mockResolvedValueOnce('A deeper read about rest after ambition.');

        const { result } = renderHook(() => useMemoryGraph());

        act(() => result.current.setSelectedNodeId('atom-1'));
        expect(result.current.remoteInsight).toBeNull();

        await waitFor(() => {
            expect(result.current.localInsight).toBe(
                'Career recovery is still the quiet center of this week.'
            );
        });
        expect(mockSynthesizeMemoryInsight).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'atom-1' }),
            expect.objectContaining({ mode: 'glance' })
        );

        await act(async () => {
            await result.current.deepenSelectedAtom();
        });

        await waitFor(() => {
            expect(result.current.remoteInsight).toBe('A deeper read about rest after ambition.');
        });
        expect(mockSynthesizeMemoryInsight).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'atom-1' }),
            expect.objectContaining({ mode: 'deep' })
        );
    });
});
