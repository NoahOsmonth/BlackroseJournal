import { sharedLabels } from '@/utils/bulkLabels';

describe('sharedLabels', () => {
    const tags = { a: ['trip', 'work'], b: ['trip'], c: ['trip', 'quiet'], d: [] };

    it('returns only the labels every picked entry has', () => {
        expect(sharedLabels(['a', 'b', 'c'], tags)).toEqual(['trip']);
    });

    it('returns nothing when the selection does not agree', () => {
        expect(sharedLabels(['a', 'c'], tags)).toEqual(['trip']);
        expect(sharedLabels(['a', 'd'], tags)).toEqual([]);
    });

    it('is empty for an empty selection', () => {
        expect(sharedLabels([], tags)).toEqual([]);
    });

    it('ignores an entry with no labels at all', () => {
        expect(sharedLabels(['d'], tags)).toEqual([]);
    });

    it('does not count a label twice for one entry', () => {
        expect(sharedLabels(['a', 'b'], { a: ['trip', 'trip'], b: ['trip'] })).toEqual(['trip']);
    });

    it('sorts the result so the sheet order is stable', () => {
        expect(sharedLabels(['a', 'b'], { a: ['zeta', 'alpha'], b: ['zeta', 'alpha'] }))
            .toEqual(['alpha', 'zeta']);
    });
});
