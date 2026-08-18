/**
 * Recall block builder — formats Hindsight recall hits into the prompt-ready
 * "## Relevant long-term context" block. Body lines match the recall-slot
 * contract (memoryPromptBudget.trimRecallBySimilarity: "- " lines with inline
 * sim=N.NN tags, ranked high→low).
 */
import type { HindsightRecallHit } from './hindsightClient';
import { hindsightRecall } from './hindsightClient';

const RECALL_LINES_MAX = 6;

function toLocalDateKey(timestamp: number): string {
    const d = new Date(timestamp);
    const mm = `${d.getMonth() + 1}`.padStart(2, '0');
    const dd = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}

export function formatRecallHitLine(hit: HindsightRecallHit): string {
    const sim = ` sim=${hit.similarity.toFixed(2)}`;
    const date = hit.timestamp ? ` (Written ${toLocalDateKey(hit.timestamp)})` : '';
    return `-${sim} ${hit.content}${date}`;
}

export async function buildHindsightRecallContext(
    query: string,
    opts: { limit?: number; bank?: string } = {}
): Promise<string | undefined> {
    if (!query.trim()) return undefined;
    const hits = await hindsightRecall(query, {
        limit: opts.limit ?? RECALL_LINES_MAX,
        bank: opts.bank,
    });
    if (!hits || hits.length === 0) return undefined;
    return [
        '## Relevant long-term context',
        'Long-term recollections from the user\u2019s past entries. Use these facts when they relate; never invent details beyond them.',
        ...hits.map(formatRecallHitLine),
    ].join('\n');
}
