import {
    personaliseShelf,
    promptsForDay,
    themePrompt,
} from '@/utils/guidedPrompts';

const DAY = '2026-11-08';
const SHELF = promptsForDay(DAY, 'anytime', 3);

describe('themePrompt', () => {
    it('writes an opening in the writer voice, not a question', () => {
        const prompt = themePrompt('sleep');
        expect(prompt.opening).toContain('sleep');
        expect(prompt.opening.trim().endsWith('?')).toBe(false);
    });

    it('gives the same word the same id', () => {
        expect(themePrompt('sleep').id).toBe(themePrompt('sleep').id);
    });

    it('keeps the word as the writer wrote it', () => {
        expect(themePrompt('running').opening).toContain('running');
    });
});

describe('personaliseShelf', () => {
    it('returns the generic shelf unchanged when there is no theme', () => {
        expect(personaliseShelf(SHELF, null).map((p) => p.id)).toEqual(SHELF.map((p) => p.id));
        expect(personaliseShelf(SHELF, '   ').map((p) => p.id)).toEqual(SHELF.map((p) => p.id));
    });

    it('offers the recurring theme', () => {
        const out = personaliseShelf(SHELF, 'sleep');
        expect(out.some((p) => p.id === 'theme-sleep')).toBe(true);
    });

    it('keeps the shelf the same length', () => {
        expect(personaliseShelf(SHELF, 'sleep')).toHaveLength(SHELF.length);
    });

    it('always leaves at least one generic prompt', () => {
        const out = personaliseShelf(SHELF, 'sleep');
        expect(out.some((p) => !p.id.startsWith('theme-'))).toBe(true);
    });

    it('does not show the same theme twice', () => {
        const once = personaliseShelf(SHELF, 'sleep');
        const twice = personaliseShelf(once, 'sleep');
        expect(twice).toHaveLength(once.length);
        expect(twice.filter((p) => p.id === 'theme-sleep')).toHaveLength(1);
    });

    it('is deterministic for the same day and theme', () => {
        expect(personaliseShelf(SHELF, 'sleep').map((p) => p.id))
            .toEqual(personaliseShelf(SHELF, 'sleep').map((p) => p.id));
    });

    it('survives an empty shelf', () => {
        expect(personaliseShelf([], 'sleep')).toEqual([]);
    });
});
