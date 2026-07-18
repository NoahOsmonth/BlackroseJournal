/**
 * PR8c: AUGMENT_BLOB_MAX_EST_TOKENS — trim lowest-similarity recall first,
 * then oldest digests; never mid-sentence (whole segments only).
 */

import {
    AUGMENT_BLOB_MAX_EST_TOKENS,
    assembleAugmentBlob,
    capAugmentSegments,
    type AugmentSegment,
} from '../../../services/ai/historyPrefetch';
import { estimateTokensFromChars } from '../../../services/ai/promptBudget';

describe('PR8c augment blob cap', () => {
    it('exports AUGMENT_BLOB_MAX_EST_TOKENS = 1500', () => {
        expect(AUGMENT_BLOB_MAX_EST_TOKENS).toBe(1_500);
    });

    it('trims oversized digest+recall fixture to ≤ cap without mid-sentence cuts', () => {
        // Pads sized so full blob > 1500 est tokens, but high-sim + headers still fit after drops.
        const recallPad = 'word '.repeat(900).trim(); // ~4500 chars each ≈ 1125 tokens
        const digestPad = 'digest '.repeat(120).trim();
        const segments: AugmentSegment[] = [
            {
                role: 'fixed',
                text: '## Relevant past context\nOn-demand session digests for THIS turn only.',
            },
            {
                role: 'recall',
                text: `- Written 2026-07-01 [high]: high similarity recall short keep`,
                similarity: 0.95,
            },
            {
                role: 'recall',
                text: `- Written 2026-06-01 [mid]: mid similarity recall ${recallPad}`,
                similarity: 0.55,
            },
            {
                role: 'recall',
                text: `- Written 2026-05-01 [low]: lowest similarity recall ${recallPad}`,
                similarity: 0.15,
            },
            {
                role: 'fixed',
                text: '## Retrieved history\nPre-fetched local day digests.',
            },
            {
                role: 'digest',
                text: `writtenDate: 2025-01-01\nsummary: oldest digest block ${digestPad}`,
                dateKey: '2025-01-01',
            },
            {
                role: 'digest',
                text: `writtenDate: 2026-07-10\nsummary: newest digest block ${digestPad}`,
                dateKey: '2026-07-10',
            },
        ];

        const uncappedEst = estimateTokensFromChars(
            segments.map((s) => s.text).join('\n\n').length
        );
        expect(uncappedEst).toBeGreaterThan(AUGMENT_BLOB_MAX_EST_TOKENS);

        const capped = capAugmentSegments(segments, AUGMENT_BLOB_MAX_EST_TOKENS);
        const blob = assembleAugmentBlob(segments, AUGMENT_BLOB_MAX_EST_TOKENS);
        const est = estimateTokensFromChars(blob.length);
        expect(est).toBeLessThanOrEqual(AUGMENT_BLOB_MAX_EST_TOKENS);

        // Lowest-similarity recall dropped first.
        expect(blob).not.toContain('lowest similarity recall');
        // High similarity (short) kept.
        expect(blob).toContain('high similarity recall short keep');
        expect(capped.some((s) => s.role === 'recall' && (s.similarity ?? 0) >= 0.9)).toBe(true);

        // Never mid-sentence: every non-empty line in output is a full original line.
        const originalLines = new Set(
            segments.flatMap((s) => s.text.split('\n').map((l) => l.trim()).filter(Boolean))
        );
        for (const line of blob.split('\n')) {
            const t = line.trim();
            if (!t) continue;
            expect(originalLines.has(t)).toBe(true);
        }
        // No truncated mid-word artifacts.
        expect(blob).not.toMatch(/\bwor$/m);
    });

    it('after recall is gone, drops oldest digests before newer ones', () => {
        const pad = 'x'.repeat(2_000);
        const segments: AugmentSegment[] = [
            { role: 'fixed', text: '## Retrieved history' },
            {
                role: 'digest',
                text: `writtenDate: 2024-01-01\nsummary: OLD ${pad}`,
                dateKey: '2024-01-01',
            },
            {
                role: 'digest',
                text: `writtenDate: 2026-07-01\nsummary: NEW ${pad}`,
                dateKey: '2026-07-01',
            },
        ];
        // Cap tight enough that only one digest can fit with header.
        const blob = assembleAugmentBlob(segments, 600);
        expect(blob).not.toContain('OLD ');
        expect(blob).toContain('NEW ');
    });
});
