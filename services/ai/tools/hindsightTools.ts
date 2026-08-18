/**
 * Hindsight-backed agent tool: on-demand long-term recall.
 * Hard-tied to the soft-fail client — returns a message, never throws.
 */
import { hindsightRecall, type HindsightRecallHit } from '@/services/memory/hindsight/hindsightClient';
import type { ToolHandler } from './types';

export const recallMemoryToolHandler: ToolHandler = async (args) => {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    if (!query) return 'No query provided. Ask with the topic you want to recall.';

    const rawLimit = args.limit;
    const limit =
        typeof rawLimit === 'number' ? Math.min(Math.max(Math.floor(rawLimit), 1), 10) : 6;

    const hits = await hindsightRecall(query, { limit });
    if (!hits || hits.length === 0) {
        return 'No long-term recollections found for that query.';
    }
    return [
        `Long-term recollections (${hits.length}):`,
        ...hits.map((hit: HindsightRecallHit) => `- ${hit.content}`),
    ].join('\n');
};
