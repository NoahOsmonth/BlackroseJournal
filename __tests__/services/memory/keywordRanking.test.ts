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
    it('tokenizes: drops stop words and sub-minimum tokens', () => {
        expect(tokenize('the work and the deadlines')).toEqual(['work', 'deadlines']);
        expect(tokenize('a b cd')).toEqual([]);
    });

    it('keeps the `> 3` floor deliberately', () => {
        // The floor was NOT unified with memoryRetrieval's `>= 3`. Doing that
        // measurably regressed recall on the R2 probe: the 3-letter token `ink`
        // enters the query set, the needle and the distractor both score 0.5,
        // and the deterministic id tie-break hands the win to the distractor.
        // See services/memory/keywordRanking.ts and the fix plan.
        expect(tokenize('dog son mom dad job')).toEqual([]);
        expect(tokenize('work deadlines')).toEqual(['work', 'deadlines']);
    });

    it('tokenizes non-Latin scripts instead of collapsing them to nothing', () => {
        // The old Latin-only `[^a-z0-9']` strip produced [] for all of these.
        // Tokens shorter than the `> 3` floor are still dropped, exactly as they
        // are for English — this restores the SCRIPT, not the floor.
        expect(tokenize('我最近工作压力很大，晚上睡不好')).not.toEqual([]);
        expect(tokenize('مرحبا بالعالم')).toEqual(['مرحبا', 'بالعالم']);
        expect(tokenize('привет мир')).toEqual(['привет']);
    });

    it('keeps accented Latin letters instead of stripping them to ASCII', () => {
        // Old rule turned 'café résumé naïve' into ['rsum', 'nave'].
        expect(tokenize('café résumé naïve')).toEqual(['café', 'résumé', 'naïve']);
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
