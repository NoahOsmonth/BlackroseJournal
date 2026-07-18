import {
    formatRelativeMemoryTime,
    memoryAtomRoute,
    memoryPortraitProse,
    profilePreview,
} from '../../components/memory/memoryDisplay';
import type { LocalMemoryAtom } from '../../services/memory/localMemory.types';

function atom(partial: Partial<LocalMemoryAtom> & Pick<LocalMemoryAtom, 'id' | 'layer'>): LocalMemoryAtom {
    return {
        source: 'journal',
        title: 't',
        content: 'c',
        tags: [],
        salience: 0.5,
        confidence: 0.5,
        createdAt: 1,
        updatedAt: 1,
        accessCount: 0,
        ...partial,
    };
}

describe('memoryDisplay helpers', () => {
    it('builds portrait prose without vanity columns', () => {
        const atoms = [
            atom({ id: '1', layer: 'profile', tags: ['a'] }),
            atom({ id: '2', layer: 'semantic', tags: ['a', 'b'] }),
            atom({ id: '3', layer: 'note' }),
        ];
        expect(memoryPortraitProse(atoms)).toBe('3 memories · 2 themes · 1 note');
    });

    it('prefers richer profile content for portrait preview', () => {
        const atoms = [
            atom({ id: '1', layer: 'profile', content: 'short', updatedAt: 2 }),
            atom({ id: '2', layer: 'profile', content: 'A longer portrait of the person.', updatedAt: 1 }),
        ];
        expect(profilePreview(atoms)).toBe('A longer portrait of the person.');
    });

    it('routes journal and check-in provenance', () => {
        expect(memoryAtomRoute(atom({
            id: '1',
            layer: 'episodic',
            rootSourceId: 'e1',
            rootSourceKind: 'journal_entry',
        }))).toEqual({ pathname: '/entry-detail', params: { id: 'e1' } });

        expect(memoryAtomRoute(atom({
            id: '2',
            layer: 'episodic',
            source: 'intention',
            rootSourceId: 'c1',
            rootSourceKind: 'intention_checkin',
        }))).toEqual({ pathname: '/checkin-detail', params: { id: 'c1' } });

        expect(memoryAtomRoute(atom({ id: '3', layer: 'note', source: 'manual' }))).toBeNull();
    });

    it('formats relative times', () => {
        const now = Date.parse('2026-06-10T12:00:00.000Z');
        expect(formatRelativeMemoryTime(now - 30_000, now)).toBe('just now');
        expect(formatRelativeMemoryTime(now - 3 * 60_000, now)).toBe('3m ago');
        expect(formatRelativeMemoryTime(now - 5 * 3_600_000, now)).toBe('5h ago');
        expect(formatRelativeMemoryTime(now - 3 * 86_400_000, now)).toBe('3d ago');
    });
});
