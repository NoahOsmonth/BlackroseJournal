/**
 * Keyword + recency fallback ranking — replaces the removed app-side
 * semantic embedding stack. Pure lexical scoring, no network, no vectors.
 */
import {
    overlapCount,
    overlapRatio,
    recencyFactor,
    scoreKeywordRecency,
    tokenize,
} from '../../../services/memory/keywordRanking';

describe('keywordRanking (fallback)', () => {
    it('tokenizes: drops stop words and short tokens', () => {
        expect(tokenize('the work and the deadlines')).toEqual(['work', 'deadlines']);
        expect(tokenize('a b cd')).toEqual([]);
    });

    it('ranks a keyword-matching candidate above a non-matching one', () => {
        const now = Date.now();
        const query = new Set(tokenize('work stress deadlines'));
        const matching = scoreKeywordRecency(
            tokenize('Work stress and crushing deadlines at the office.'),
            query,
            now - 5 * 86_400_000,
            now,
        );
        const nonMatching = scoreKeywordRecency(
            tokenize('Tomato pasta recipe night.'),
            query,
            now - 5 * 86_400_000,
            now,
        );
        expect(matching).toBeGreaterThan(nonMatching);
    });

    it('overlapCount gates candidates (0 for no shared token)', () => {
        const query = new Set(tokenize('work deadlines'));
        expect(overlapCount(tokenize('pasta recipe'), query)).toBe(0);
        expect(overlapCount(tokenize('work pressure'), query)).toBeGreaterThan(0);
    });

    it('recencyFactor decays over ~30 days', () => {
        const now = Date.now();
        const fresh = recencyFactor(now - 86_400_000, now);
        const old = recencyFactor(now - 90 * 86_400_000, now);
        expect(fresh).toBeGreaterThan(old);
    });

    it('overlapRatio stays bounded in [0, 1]', () => {
        const query = new Set(tokenize('work deadlines'));
        expect(overlapRatio(tokenize('pasta recipe'), query)).toBe(0);
        expect(overlapRatio(tokenize('work and deadlines'), query)).toBeGreaterThan(0);
        expect(overlapRatio(tokenize('work and deadlines'), query)).toBeLessThanOrEqual(1);
    });
});
