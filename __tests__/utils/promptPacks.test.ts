import {
    PROMPT_PACKS,
    allPackPrompts,
    isKnownPromptId,
    normalizeSavedPromptIds,
    packById,
    promptsInPack,
    savedPrompts,
} from '../../utils/promptPacks';
import { GUIDED_PROMPTS } from '../../utils/guidedPrompts';

describe('prompt packs', () => {
    it('offers several themed packs with plain, non-empty copy', () => {
        expect(PROMPT_PACKS.length).toBeGreaterThanOrEqual(4);
        for (const pack of PROMPT_PACKS) {
            expect(pack.title.trim().length).toBeGreaterThan(0);
            expect(pack.description.trim().length).toBeGreaterThan(0);
            expect(pack.promptIds.length).toBeGreaterThan(0);
        }
    });

    it('pack ids are unique', () => {
        expect(new Set(PROMPT_PACKS.map((p) => p.id)).size).toBe(PROMPT_PACKS.length);
    });

    it('every referenced starter really exists', () => {
        for (const pack of PROMPT_PACKS) {
            expect(promptsInPack(pack)).toHaveLength(pack.promptIds.length);
            for (const prompt of promptsInPack(pack)) {
                expect(GUIDED_PROMPTS.some((p) => p.id === prompt.id)).toBe(true);
            }
        }
    });

    it('drops unknown ids instead of showing a broken row', () => {
        const fake = { id: 'x', title: 'X', description: 'x', promptIds: ['one-thing', 'not-real'] };
        expect(promptsInPack(fake).map((p) => p.id)).toEqual(['one-thing']);
    });

    it('allPackPrompts has no duplicates and covers every pack', () => {
        const all = allPackPrompts();
        expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
        for (const pack of PROMPT_PACKS) {
            for (const id of pack.promptIds) expect(all.some((p) => p.id === id)).toBe(true);
        }
    });

    it('packById resolves a known pack and rejects an unknown one safely', () => {
        expect(packById(PROMPT_PACKS[0].id)?.title).toBe(PROMPT_PACKS[0].title);
        expect(packById('no-such-pack')).toBeUndefined();
    });

    it('known ids include real starters and personal theme starters', () => {
        expect(isKnownPromptId('one-thing')).toBe(true);
        expect(isKnownPromptId('theme-garden')).toBe(true);
        expect(isKnownPromptId('stranger-things')).toBe(false);
    });

    it('normalizeSavedPromptIds drops blanks, duplicates and unknown ids', () => {
        expect(normalizeSavedPromptIds(['one-thing', '', 'one-thing', 'nope', 'grateful'])).toEqual(['one-thing', 'grateful']);
    });

    it('normalizeSavedPromptIds tolerates a corrupt payload', () => {
        expect(normalizeSavedPromptIds(null)).toEqual([]);
        expect(normalizeSavedPromptIds({ saved: ['one-thing'] })).toEqual([]);
        expect(normalizeSavedPromptIds([1, 'one-thing', null])).toEqual(['one-thing']);
    });

    it('savedPrompts resolves favorites and drops ids with no starter', () => {
        const list = savedPrompts(['grateful', 'theme-garden']);
        expect(list).toHaveLength(1);
        expect(list[0].id).toBe('grateful');
    });

    it('is deterministic', () => {
        expect([...allPackPrompts()]).toEqual([...allPackPrompts()]);
        expect(normalizeSavedPromptIds(['body', 'worry'])).toEqual(normalizeSavedPromptIds(['body', 'worry']));
    });
});
