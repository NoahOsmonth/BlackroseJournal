import { extractTags } from '../../services/memory/keywordRanking';

describe('extractTags', () => {
    it('ranks tokens by frequency and drops short words and stopwords', () => {
        expect(extractTags('mornings calm mornings help me think mornings'))
            .toEqual(['mornings', 'calm', 'help', 'think']);
    });

    it('returns an empty list when nothing survives tokenization', () => {
        expect(extractTags('it was a day')).toEqual([]);
    });

    it('keeps seed tags ahead of derived ones', () => {
        expect(extractTags('calm mornings', ['intention'])).toEqual(['intention', 'calm', 'mornings']);
    });

    it('caps derived tags at eight', () => {
        expect(extractTags('alpha bravo charlie delta echo foxtrot golf hotel india juliet'))
            .toHaveLength(8);
    });
});
