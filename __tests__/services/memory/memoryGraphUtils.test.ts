import {
    computeConnections,
    filterAtomsByLayer,
    filterAtomsByTime,
} from '../../../services/memory/memoryGraphUtils';
import type {
    MemoryGraphAtom,
    MemoryLayer,
} from '../../../services/memory/memoryGraph.types';

function atom(
    id: string,
    layer: MemoryLayer,
    tags: string[],
    createdAt = '2026-01-01T00:00:00.000Z'
): MemoryGraphAtom {
    return {
        id,
        entryId: id,
        source: 'journal',
        title: id,
        content: `Memory ${id}`,
        layer,
        salience: 5,
        confidence: 0.8,
        tags,
        createdAt,
    };
}

describe('memoryGraphUtils', () => {
    it('connects atoms with shared tags and caps strength', () => {
        const connections = computeConnections([
            atom('a', 'episodic', ['career', 'rest', 'sleep', 'focus', 'home']),
            atom('b', 'profile', ['rest', 'career', 'sleep', 'focus', 'home']),
            atom('c', 'note', ['garden']),
        ]);

        expect(connections).toEqual([{
            from: 'a',
            to: 'b',
            strength: 1,
            tags: ['career', 'rest', 'sleep', 'focus', 'home'],
        }]);
    });

    it('filters atoms by layer and time window', () => {
        const atoms = [
            atom('recent-profile', 'profile', [], '2026-01-10T00:00:00.000Z'),
            atom('old-profile', 'profile', [], '2025-12-01T00:00:00.000Z'),
            atom('recent-note', 'note', [], '2026-01-09T00:00:00.000Z'),
        ];

        const layerFiltered = filterAtomsByLayer(atoms, new Set(['profile']));
        const timeFiltered = filterAtomsByTime(
            atoms,
            14,
            Date.parse('2026-01-15T00:00:00.000Z')
        );

        expect(layerFiltered.map((item) => item.id)).toEqual([
            'recent-profile',
            'old-profile',
        ]);
        expect(timeFiltered.map((item) => item.id)).toEqual([
            'recent-profile',
            'recent-note',
        ]);
    });
});
