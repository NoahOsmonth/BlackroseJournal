import {
    migrateAtomProvenance,
    resolveRootSource,
} from '../../../services/memory/memoryProvenance';
import type { LocalMemoryAtom } from '../../../services/memory/localMemory.types';

function atom(overrides: Partial<LocalMemoryAtom>): LocalMemoryAtom {
    return {
        id: 'journal:episodic:entry-1',
        layer: 'episodic',
        source: 'journal',
        sourceId: 'entry-1',
        title: 'Title',
        content: 'Content',
        tags: [],
        salience: 0.5,
        confidence: 0.5,
        createdAt: 1,
        updatedAt: 1,
        accessCount: 0,
        ...overrides,
    };
}

describe('memoryProvenance', () => {
    it('prefers explicit rootSource fields', () => {
        expect(resolveRootSource(atom({
            rootSourceId: 'entry-9',
            rootSourceKind: 'journal_entry',
            sourceId: 'entry-9:profile',
        }))).toEqual({ id: 'entry-9', kind: 'journal_entry' });
    });

    it('parses legacy composite journal sourceIds', () => {
        expect(resolveRootSource(atom({
            sourceId: 'entry-1:profile',
            layer: 'profile',
        }))).toEqual({ id: 'entry-1', kind: 'journal_entry' });

        expect(resolveRootSource(atom({
            sourceId: 'entry-1:topic:career',
            layer: 'semantic',
        }))).toEqual({ id: 'entry-1', kind: 'journal_entry' });
    });

    it('does not treat theme/profile merge keys as navigable roots', () => {
        expect(resolveRootSource(atom({
            sourceId: 'theme:morning',
            layer: 'semantic',
        }))).toBeNull();

        expect(resolveRootSource(atom({
            sourceId: 'profile:walking',
            layer: 'profile',
            rootSourceId: undefined,
            rootSourceKind: undefined,
        }))).toBeNull();
    });

    it('renames About the user titles on soft migrate', () => {
        const migrated = migrateAtomProvenance(atom({
            title: 'About the user',
            content: 'Recent journal pattern: Slow mornings help.',
            sourceId: 'entry-1:profile',
            layer: 'profile',
        }));

        expect(migrated.title).not.toBe('About the user');
        expect(migrated.title.toLowerCase()).toContain('slow mornings');
        expect(migrated.rootSourceId).toBe('entry-1');
        expect(migrated.rootSourceKind).toBe('journal_entry');
    });
});
