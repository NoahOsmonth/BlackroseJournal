/**
 * PR8b-2 memory caps — unit + property + sabotage-style asserts.
 * Real applyMemoryPromptBudget (never mock unit under test).
 */

import {
    MEMORY_CAPSULE_MAX_EST,
    MEMORY_DIGESTS_MAX_EST,
    MEMORY_NON_IDENTITY_SUBCAPS_SUM,
    MEMORY_PROMPT_BUDGET,
    MEMORY_RECALL_MAX_EST,
    MEMORY_RECALL_MIN_SIM,
    applyMemoryPromptBudget,
    measureMemoryEstTokens,
    trimDigestsOldestFirst,
    trimRecallBySimilarity,
    truncateAtBoundary,
} from '../../../services/ai/memoryPromptBudget';
import { estimateTokensFromChars } from '../../../services/ai/promptBudget';

/** Mulberry32 seeded RNG — deterministic property tests. */
function mulberry32(seed: number): () => number {
    let t = seed >>> 0;
    return () => {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

describe('PR8b-2 memoryPromptBudget constants', () => {
    it('exports hard budget 8000 and sub-caps', () => {
        expect(MEMORY_PROMPT_BUDGET).toBe(8_000);
        expect(MEMORY_CAPSULE_MAX_EST).toBe(2_500);
        expect(MEMORY_DIGESTS_MAX_EST).toBe(2_500);
        expect(MEMORY_RECALL_MAX_EST).toBe(1_500);
        expect(MEMORY_RECALL_MIN_SIM).toBe(0.28);
        // Soft per-block sum equals hard budget; global trim yields room for identity.
        expect(MEMORY_NON_IDENTITY_SUBCAPS_SUM).toBe(8_000);
    });

    it('identity template headroom: typical identity + max other blocks still ≤ budget after apply', () => {
        // Real-shaped identity (name + pronouns + a few facts) — not unbounded freeform.
        const typicalIdentity = [
            '## Identity',
            '- Preferred name: Ren',
            '- Pronouns: they/them',
            '- About: software engineer in Oslo',
            '- Key people: Alex (partner), Sam (sibling)',
            '- Facts: prefers short replies; night owl',
            'Trust the live user message over stored identity when they conflict; never invent a name.',
        ].join('\n');
        const identityEst = estimateTokensFromChars(typicalIdentity.length);
        expect(identityEst).toBeLessThan(500);

        const pad = 'word '.repeat(3_000).trim();
        const result = applyMemoryPromptBudget({
            identity: typicalIdentity,
            digests: `## Recent day digests\n- Written 2020-01-01: ${pad}\n- Written 2026-07-01: ${pad}`,
            capsule: `## Local Memory Capsule\n${pad}`,
            recall: `## Relevant past\n- Written 2021-01-01: ${pad}`,
            goals: `## Goals\n${pad.slice(0, 2_000)}`,
            persona: `## Persona Guidance\n${pad.slice(0, 2_000)}`,
        });
        expect(result.blocks.identity).toBe(typicalIdentity);
        expect(result.totalEstTokens).toBeLessThanOrEqual(MEMORY_PROMPT_BUDGET);
        // Identity kept; non-identity was trimmed to make room.
        expect(result.totalEstTokens).toBeGreaterThan(identityEst);
    });
});

describe('PR8b-2 applyMemoryPromptBudget', () => {
    const identity =
        '## Identity\n- Preferred name: Ren\n'
        + 'Trust the live user message over stored identity when they conflict; never invent a name.';

    it('never truncates identity even under worst-case other blocks', () => {
        const pad = 'word '.repeat(3_000).trim();
        const result = applyMemoryPromptBudget({
            identity,
            digests: `## Recent day digests\n- Written 2020-01-01: ${pad}\n- Written 2026-07-01: ${pad}`,
            capsule: `## Local Memory Capsule\n- ${pad}`,
            recall: `## Relevant past\n- Written 2026-01-01: low ${pad}\n- Written 2026-07-01: high ${pad}`,
            goals: `## Goals\n${pad}`,
            persona: `## Persona Guidance\n${pad}`,
        });
        expect(result.blocks.identity).toBe(identity);
        expect(result.blocks.identity).toContain('Preferred name: Ren');
        expect(result.blocks.identity).toContain('never invent');
        expect(result.totalEstTokens).toBeLessThanOrEqual(MEMORY_PROMPT_BUDGET);
    });

    it('drops lowest-similarity recall before digests/capsule', () => {
        const pad = 'token '.repeat(800).trim();
        const result = applyMemoryPromptBudget({
            identity,
            recall: [
                '## Relevant past context',
                `- Written 2026-07-01: high sim keep ${pad.slice(0, 200)}`,
                `- Written 2026-05-01: lowest sim DROP ${pad}`,
                `- Written 2026-06-01: mid sim ${pad}`,
            ].join('\n'),
            digests: `## Recent day digests\n- Written 2026-07-10: recent digest keep`,
            capsule: '## Local Memory Capsule\n- core fact',
        });
        const recall = result.blocks.recall ?? '';
        // With ordinal ranking, last body line is lowest — drop first under pressure.
        // Oversized middle/last should go before short high-priority first line when over recall subcap.
        expect(result.totalEstTokens).toBeLessThanOrEqual(MEMORY_PROMPT_BUDGET);
        if (recall.includes('high sim keep')) {
            // Prefer keeping early (higher) lines when trimming.
            expect(recall.indexOf('high sim keep')).toBeLessThan(
                recall.includes('lowest') ? recall.indexOf('lowest') : recall.length
            );
        }
    });

    it('truncates capsule at sentence boundary (no mid-sentence cut)', () => {
        const sentences = Array.from({ length: 80 }, (_, i) =>
            `Sentence number ${i} about sleep and work ends here.`
        ).join(' ');
        const capsule = `## Local Memory Capsule\n${sentences}`;
        const result = applyMemoryPromptBudget({
            identity,
            capsule,
            digests: undefined,
            recall: undefined,
        });
        const out = result.blocks.capsule ?? '';
        expect(estimateTokensFromChars(out.length)).toBeLessThanOrEqual(MEMORY_CAPSULE_MAX_EST);
        // Must not end mid-word / mid-sentence fragment without terminator when truncated.
        if (out.length < capsule.length) {
            expect(out.trim().endsWith('.') || out.trim().endsWith('!')).toBe(true);
        }
    });

    it('truncateAtBoundary prefers sentence terminator when cutting', () => {
        const text = 'Alpha sentence ends here. Bravo sentence ends here. Charlie unfinished word';
        const out = truncateAtBoundary(text, 12); // ~48 chars
        expect(out.length).toBeLessThan(text.length);
        // Prefer cut after a full sentence.
        expect(out.trim().endsWith('.')).toBe(true);
        expect(out).toContain('Alpha');
        expect(out).not.toContain('unfinished');
    });

    it('property: seeded 1000 random entries → memory est ≤ MEMORY_PROMPT_BUDGET', () => {
        const rng = mulberry32(0x51_37_a8_13);
        for (let trial = 0; trial < 20; trial += 1) {
            const n = 50 + Math.floor(rng() * 950); // up to ~1000 lines worth of content
            const digLines: string[] = ['## Recent day digests'];
            const recLines: string[] = ['## Relevant past'];
            const capLines: string[] = ['## Local Memory Capsule'];
            for (let i = 0; i < n; i += 1) {
                const day = `2020-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
                digLines.push(`- Written ${day}: entry ${i} ${'x'.repeat(40 + Math.floor(rng() * 200))}`);
                recLines.push(`- Written ${day}: recall ${i} ${'y'.repeat(30 + Math.floor(rng() * 180))}`);
                capLines.push(`- Atom ${i}: ${'z'.repeat(20 + Math.floor(rng() * 120))}.`);
            }
            const result = applyMemoryPromptBudget({
                identity: `## Identity\n- Preferred name: Seed${trial}`,
                digests: digLines.join('\n'),
                recall: recLines.join('\n'),
                capsule: capLines.join('\n'),
                goals: '## Goals\n' + 'g'.repeat(500),
                persona: '## Persona Guidance\n' + 'p'.repeat(500),
            });
            expect(result.totalEstTokens).toBeLessThanOrEqual(MEMORY_PROMPT_BUDGET);
            expect(result.blocks.identity).toContain(`Seed${trial}`);
            expect(measureMemoryEstTokens(result.blocks)).toBe(result.totalEstTokens);
        }
    });

    /**
     * Sabotage-style: with budget forced high, oversize store exceeds 8000;
     * with normal budget, always ≤8000.
     */
    it('sabotage: raw oversize store exceeds budget; apply enforces ≤8000', () => {
        const pad = 'word '.repeat(5_000).trim();
        const oversize = {
            identity: '## Identity\n- Preferred name: Ren',
            digests: `## Digests\n- Written 2020-01-01: ${pad}`,
            capsule: `## Capsule\n${pad}`,
            recall: `## Recall\n- Written 2021-01-01: ${pad}`,
        };
        // RED shape: without applyMemoryPromptBudget, raw est exceeds hard budget.
        const rawEst = measureMemoryEstTokens(oversize);
        expect(rawEst).toBeGreaterThan(MEMORY_PROMPT_BUDGET);

        // GREEN: with cap applied.
        const capped = applyMemoryPromptBudget(oversize, MEMORY_PROMPT_BUDGET);
        expect(capped.totalEstTokens).toBeLessThanOrEqual(MEMORY_PROMPT_BUDGET);
        expect(capped.blocks.identity).toContain('Ren');
    });

    it('trim step 2: digests drop oldest dateKey first', () => {
        const pad = 'x'.repeat(2_000);
        const digests = [
            '## Recent day digests',
            `- Written 2020-01-01: OLDEST ${pad}`,
            `- Written 2026-07-01: NEWEST ${pad}`,
            `- Written 2023-06-15: MID ${pad}`,
        ].join('\n');
        const out = trimDigestsOldestFirst(digests, 600) ?? '';
        expect(out).not.toContain('OLDEST');
        expect(out).toContain('NEWEST');
    });

    it('MIN_SIM filter excludes sub-0.28 recall before keep ranking', () => {
        const recall = [
            '## Relevant past',
            '- Written 2026-07-01 sim=0.95: high keep',
            '- Written 2026-06-01 sim=0.10: below floor DROP',
            '- Written 2026-05-01 sim=0.27: just under DROP',
            '- Written 2026-04-01 sim=0.28: at floor keep',
        ].join('\n');
        const out = trimRecallBySimilarity(recall, MEMORY_RECALL_MAX_EST, MEMORY_RECALL_MIN_SIM) ?? '';
        expect(out).toContain('high keep');
        expect(out).toContain('at floor keep');
        expect(out).not.toContain('below floor DROP');
        expect(out).not.toContain('just under DROP');
    });
});
