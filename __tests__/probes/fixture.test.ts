/**
 * Offline fixture invariants — always runs (no network, no PROBE_LLM).
 */

import {
    ENTRY_COUNT,
    SEMANTIC_NEEDLE_TOKEN,
    buildProbeFixture,
    listJournals,
    searchJournalsKeyword,
} from '../../probes/shared/fixture';

describe('probe fixture (offline)', () => {
    const fixture = buildProbeFixture();

    it('builds exactly 365 deterministic entries with both needles', () => {
        expect(fixture.entries).toHaveLength(ENTRY_COUNT);
        const again = buildProbeFixture();
        expect(again.entries[0]?.id).toBe(fixture.entries[0]?.id);
        expect(again.semanticNeedleId).toBe(fixture.semanticNeedleId);

        const semantic = fixture.entries.find((e) => e.isSemanticNeedle);
        expect(semantic).toBeTruthy();
        expect(semantic!.body).toContain(SEMANTIC_NEEDLE_TOKEN);
        // ~11 months before 2026-07-17 → around 2025-08
        expect(semantic!.dateISO.startsWith('2025-0') || semantic!.dateISO.startsWith('2025-1')).toBe(
            true,
        );

        const listOnly = fixture.entries.find((e) => e.isListOnlyNeedle);
        expect(listOnly).toBeTruthy();
        expect(listOnly!.id).toBe(fixture.oldestId);
        expect(listOnly!.body.toLowerCase()).toContain('first day');

        const distractors = fixture.entries.filter((e) => e.isNearTopicDistractor);
        expect(distractors.length).toBe(15);

        for (const e of fixture.entries) {
            expect(e.wordCount).toBeGreaterThanOrEqual(40);
            expect(e.wordCount).toBeLessThanOrEqual(320);
        }
    });

    it('paginates newest-first and keyword-finds the semantic token', () => {
        const page = listJournals(fixture, null, 10);
        expect(page.items).toHaveLength(10);
        expect(page.items[0]!.dateISO >= page.items[9]!.dateISO).toBe(true);

        const hits = searchJournalsKeyword(fixture, SEMANTIC_NEEDLE_TOKEN, 5);
        expect(hits.some((h) => h.id === fixture.semanticNeedleId)).toBe(true);
    });
});
