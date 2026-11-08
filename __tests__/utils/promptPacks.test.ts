import {
    PROMPT_PACKS,
    allPackPrompts,
    isKnownPromptId,
    normalizeSavedPromptIds,
    normalizeWrittenStarterIds,
    packById,
    packProgress,
    promptsInPack,
    savedPrompts,
    writtenIdsInPack,
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

    describe('pack progress', () => {
        const quiet = PROMPT_PACKS.find((pack) => pack.id === 'quiet-start')!;
        const total = new Set(promptsInPack(quiet).map((prompt) => prompt.id)).size;

        it('counts nothing before any starter was written', () => {
            expect(packProgress(quiet, [])).toEqual({ done: 0, total });
        });

        it('counts distinct ids that this pack actually offers', () => {
            const offered = [...new Set(promptsInPack(quiet).map((prompt) => prompt.id))];
            expect(packProgress(quiet, [offered[0], offered[1], offered[0]])).toEqual({ done: 2, total });
        });

        it('ignores ids from other packs and unknown ids', () => {
            const outside = allPackPrompts().find((prompt) => !promptsInPack(quiet).some((p) => p.id === prompt.id))!;
            expect(packProgress(quiet, [outside.id, 'not-a-starter', '']).done).toBe(0);
        });

        it('never reports more done than the pack offers', () => {
            const many = [...allPackPrompts().map((prompt) => prompt.id), 'theme-extra'];
            const result = packProgress(quiet, many);
            expect(result.done).toBe(result.total);
        });

        it('safe normalize drops blanks, duplicates and unknown ids', () => {
            expect(normalizeWrittenStarterIds(['body', 'body', '', null, 'unknown-id', 7])).toEqual(['body']);
            expect(normalizeWrittenStarterIds(null)).toEqual([]);
            expect(normalizeWrittenStarterIds('body')).toEqual([]);
        });

        it("writtenIdsInPack returns only the pack's written rows", () => {
            const offered = [...new Set(promptsInPack(quiet).map((prompt) => prompt.id))];
            const set = writtenIdsInPack(quiet, [offered[0], 'unknown-id']);
            expect([...set]).toEqual([offered[0]]);
        });

        it('is deterministic', () => {
            expect(packProgress(quiet, ['body'])).toEqual(packProgress(quiet, ['body']));
        });
    });
});
