/**
 * PR8b-2 — memory caps hygiene at final assembly.
 *
 * AUGMENT_BLOB_MAX_EST_TOKENS (1500) remains the eager-blob constraint in
 * historyPrefetch. This module caps ALL memory surfaces in the assembled
 * system prompt. When both apply, the stricter cap wins.
 *
 * Identity is sacred and never truncated.
 */

import { estimateTokensFromChars } from './promptBudget';

/** Hard cap for sum of memory-related blocks (est tokens, chars/4). */
export const MEMORY_PROMPT_BUDGET = 8_000;

/** Sub-caps (est tokens). Identity is uncapped / sacred. */
export const MEMORY_CAPSULE_MAX_EST = 2_500;
export const MEMORY_DIGESTS_MAX_EST = 2_500;
export const MEMORY_RECALL_MAX_EST = 1_500;
/** goals + persona combined */
export const MEMORY_META_MAX_EST = 1_500;

/**
 * Soft sum of non-identity sub-caps (capsule+digests+recall+meta) = 8000.
 * These are per-block ceilings; the global MEMORY_PROMPT_BUDGET loop then
 * trims non-identity blocks further so totalEst (including identity) ≤ 8000.
 * Identity is sacred and never truncated. Typical identity templates are
 * small (≪ 500 est); if identity alone exceeded the budget we still never
 * truncate it — that is the one intentional exception to the hard ceiling.
 */
export const MEMORY_NON_IDENTITY_SUBCAPS_SUM =
    MEMORY_CAPSULE_MAX_EST
    + MEMORY_DIGESTS_MAX_EST
    + MEMORY_RECALL_MAX_EST
    + MEMORY_META_MAX_EST;

/** Align with sessionRecall MIN_SIMILARITY. */
export const MEMORY_RECALL_MIN_SIM = 0.28;

export interface MemoryPromptBlocks {
    identity?: string;
    /** Recent day digests / rollups (## Recent day digests). */
    digests?: string;
    /** ## Local Memory Capsule */
    capsule?: string;
    /** ## Retrieved history / ## Relevant past context */
    recall?: string;
    goals?: string;
    persona?: string;
}

export interface MemoryPromptBudgetResult {
    blocks: MemoryPromptBlocks;
    totalEstTokens: number;
    trimmed: boolean;
}

function est(text: string | undefined): number {
    if (!text) return 0;
    return estimateTokensFromChars(text.length);
}

function totalEst(blocks: MemoryPromptBlocks): number {
    return (
        est(blocks.identity)
        + est(blocks.digests)
        + est(blocks.capsule)
        + est(blocks.recall)
        + est(blocks.goals)
        + est(blocks.persona)
    );
}

/** Truncate text to max est tokens at a line or sentence boundary (never mid-word). */
export function truncateAtBoundary(text: string, maxEstTokens: number): string {
    if (est(text) <= maxEstTokens) return text;
    const maxChars = Math.max(0, maxEstTokens * 4);
    if (text.length <= maxChars) return text;

    const cut = text.slice(0, maxChars);
    // Prefer last sentence terminator in the window (include end-of-string '.').
    const terminatorRe = /[.!?](?=\s|$)/g;
    let best = -1;
    let m: RegExpExecArray | null;
    while ((m = terminatorRe.exec(cut)) !== null) {
        best = m.index + 1;
    }
    if (best > Math.min(16, maxChars * 0.25)) {
        return cut.slice(0, best).trimEnd();
    }
    // Fall back to last full line, then last space.
    const nl = cut.lastIndexOf('\n');
    if (nl > maxChars * 0.25) return cut.slice(0, nl).trimEnd();
    const sp = cut.lastIndexOf(' ');
    if (sp > 0) return cut.slice(0, sp).trimEnd();
    return cut.trimEnd();
}

/**
 * Drop lowest-similarity recall body lines (lines starting with "- ").
 * Header lines (##, prose) are fixed. similarity is ordinal if not tagged:
 * later body lines = lower similarity (already ranked high→low by builders).
 */
export function trimRecallBySimilarity(
    recall: string | undefined,
    maxEstTokens: number,
    minSim: number = MEMORY_RECALL_MIN_SIM
): string | undefined {
    if (!recall) return undefined;
    const lines = recall.split('\n');
    const header: string[] = [];
    const body: { line: string; sim: number }[] = [];
    let bodyIndex = 0;
    for (const line of lines) {
        if (line.startsWith('- ')) {
            // Prefer explicit sim=N.NN tag if present.
            const m = /sim=([0-9.]+)/i.exec(line);
            const sim = m ? Number(m[1]) : 1 - bodyIndex / Math.max(1, 20);
            bodyIndex += 1;
            if (sim < minSim) continue;
            body.push({ line, sim });
        } else if (body.length === 0) {
            header.push(line);
        } else {
            header.push(line);
        }
    }

    // Sort keep high sim; drop lowest first while over budget.
    body.sort((a, b) => b.sim - a.sim);
    let kept = [...body];
    const join = () => [...header, ...kept.map((b) => b.line)].join('\n');
    while (kept.length > 0 && est(join()) > maxEstTokens) {
        // Drop lowest sim (last in high→low list).
        kept = kept.slice(0, -1);
    }
    const out = join().trim();
    return out.length ? out : undefined;
}

/** Drop oldest digest blocks (writtenDate / Written YYYY-MM-DD). Keep headers. */
export function trimDigestsOldestFirst(
    digests: string | undefined,
    maxEstTokens: number
): string | undefined {
    if (!digests) return undefined;
    if (est(digests) <= maxEstTokens) return digests;

    // Split into header + body lines (each "- Written …" or blank-separated blocks).
    const parts = digests.split(/\n(?=- Written )/);
    if (parts.length <= 1) {
        return truncateAtBoundary(digests, maxEstTokens);
    }
    const header = parts[0].startsWith('- Written ') ? '' : parts[0];
    const bodies = parts[0].startsWith('- Written ')
        ? parts
        : parts.slice(1);

    // Extract date keys; oldest first to drop.
    const scored = bodies.map((block) => {
        const m = /Written (\d{4}-\d{2}-\d{2})/.exec(block);
        return { block, dateKey: m?.[1] ?? '9999-99-99' };
    });
    scored.sort((a, b) => b.dateKey.localeCompare(a.dateKey)); // newest first keep

    let kept = [...scored];
    const join = () => [header, ...kept.map((k) => k.block)].filter(Boolean).join('\n');
    while (kept.length > 0 && est(join()) > maxEstTokens) {
        // Drop oldest = smallest dateKey among kept.
        let oldestIdx = 0;
        for (let i = 1; i < kept.length; i += 1) {
            if (kept[i].dateKey < kept[oldestIdx].dateKey) oldestIdx = i;
        }
        kept.splice(oldestIdx, 1);
    }
    const out = join().trim();
    return out.length ? out : undefined;
}

function applySubCaps(blocks: MemoryPromptBlocks): MemoryPromptBlocks {
    return {
        identity: blocks.identity, // sacred
        digests: blocks.digests
            ? (est(blocks.digests) > MEMORY_DIGESTS_MAX_EST
                ? trimDigestsOldestFirst(blocks.digests, MEMORY_DIGESTS_MAX_EST)
                : blocks.digests)
            : undefined,
        capsule: blocks.capsule
            ? (est(blocks.capsule) > MEMORY_CAPSULE_MAX_EST
                ? truncateAtBoundary(blocks.capsule, MEMORY_CAPSULE_MAX_EST)
                : blocks.capsule)
            : undefined,
        recall: blocks.recall
            ? trimRecallBySimilarity(blocks.recall, MEMORY_RECALL_MAX_EST, MEMORY_RECALL_MIN_SIM)
            : undefined,
        goals: blocks.goals,
        persona: blocks.persona,
    };
}

function capMeta(blocks: MemoryPromptBlocks): MemoryPromptBlocks {
    const goalsEst = est(blocks.goals);
    const personaEst = est(blocks.persona);
    if (goalsEst + personaEst <= MEMORY_META_MAX_EST) return blocks;
    // Prefer keep goals; shrink persona first, then goals.
    let persona = blocks.persona;
    let goals = blocks.goals;
    if (persona && goalsEst + est(persona) > MEMORY_META_MAX_EST) {
        const room = Math.max(0, MEMORY_META_MAX_EST - goalsEst);
        persona = room > 20 ? truncateAtBoundary(persona, room) : undefined;
    }
    if (goals && est(goals) + est(persona) > MEMORY_META_MAX_EST) {
        goals = truncateAtBoundary(goals, MEMORY_META_MAX_EST - est(persona));
    }
    return { ...blocks, goals, persona };
}

/**
 * Apply sub-caps then MEMORY_PROMPT_BUDGET with trim order:
 * 1) lowest-sim recall  2) oldest digests  3) capsule sentence  4) meta
 * Identity never touched.
 */
export function applyMemoryPromptBudget(
    input: MemoryPromptBlocks,
    budget: number = MEMORY_PROMPT_BUDGET
): MemoryPromptBudgetResult {
    let blocks = capMeta(applySubCaps({ ...input }));
    const before = totalEst(blocks);
    let trimmed = before !== totalEst(input) || before > budget;

    // Global budget loop.
    while (totalEst(blocks) > budget) {
        trimmed = true;
        // 1. Drop lowest-sim recall lines
        if (blocks.recall && est(blocks.recall) > 0) {
            const next = trimRecallBySimilarity(
                blocks.recall,
                Math.max(0, est(blocks.recall) - 50),
                MEMORY_RECALL_MIN_SIM
            );
            if (next !== blocks.recall) {
                blocks = { ...blocks, recall: next };
                continue;
            }
            // Drop recall entirely if still needed.
            if (totalEst(blocks) > budget) {
                blocks = { ...blocks, recall: undefined };
                continue;
            }
        }
        // 2. Oldest digests
        if (blocks.digests && est(blocks.digests) > 0) {
            const next = trimDigestsOldestFirst(
                blocks.digests,
                Math.max(0, est(blocks.digests) - 50)
            );
            if (next !== blocks.digests) {
                blocks = { ...blocks, digests: next };
                continue;
            }
            if (totalEst(blocks) > budget) {
                blocks = { ...blocks, digests: undefined };
                continue;
            }
        }
        // 3. Capsule at sentence boundary
        if (blocks.capsule && est(blocks.capsule) > 0) {
            const next = truncateAtBoundary(
                blocks.capsule,
                Math.max(0, est(blocks.capsule) - 50)
            );
            if (next !== blocks.capsule && next.length > 0) {
                blocks = { ...blocks, capsule: next };
                continue;
            }
            if (totalEst(blocks) > budget) {
                blocks = { ...blocks, capsule: undefined };
                continue;
            }
        }
        // 4. Metadata
        if (blocks.persona) {
            blocks = { ...blocks, persona: undefined };
            continue;
        }
        if (blocks.goals) {
            blocks = { ...blocks, goals: undefined };
            continue;
        }
        // Identity remains; cannot trim further.
        break;
    }

    return {
        blocks,
        totalEstTokens: totalEst(blocks),
        trimmed,
    };
}

/** Sum of memory est tokens for tests / property checks. */
export function measureMemoryEstTokens(blocks: MemoryPromptBlocks): number {
    return totalEst(blocks);
}
