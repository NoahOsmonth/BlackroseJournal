import { relatedGraphAtoms } from '../../../services/memory/localMemorySynthesis';
import type { MemoryGraphAtom } from '../../../services/memory/memoryGraph.types';

function atom(overrides: Partial<MemoryGraphAtom>): MemoryGraphAtom {
    return {
        id: 'a1',
        entryId: 'e1',
        source: 'journal',
        rootSourceId: 'e1',
        rootSourceKind: 'journal_entry',
        title: 'Morning coffee',
        content: 'Felt calm.',
        layer: 'episodic',
        salience: 7,
        confidence: 0.8,
        tags: ['morning', 'calm'],
        createdAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
    };
}

describe('localMemorySynthesis', () => {
    it('returns related atoms preferring same-root siblings', () => {
        const selected = atom({ id: 'a1' });
        const sibling = atom({ id: 'a2', title: 'Sibling', rootSourceId: 'e1' });
        const distant = atom({
            id: 'a3',
            title: 'Distant',
            rootSourceId: 'other',
            tags: ['x'],
        });

        const related = relatedGraphAtoms(
            selected,
            [selected, sibling, distant],
            [{ from: 'a1', to: 'a3', strength: 0.5, tags: ['x'] }],
            3
        );

        expect(related[0]?.id).toBe('a2');
        expect(related.map((item) => item.id)).toContain('a3');
    });
});
