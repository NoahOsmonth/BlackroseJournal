/**
 * Asks the writer's own AI for the tasks an entry implies.
 *
 * Doctrine: extraction never writes. It returns titles, the screen shows them,
 * and the writer taps the ones worth keeping — which then go through the goals
 * store like any other task. A model that answers with garbage yields an empty
 * list, never an error the writer has to read.
 */

import { fetchDirectJsonCompletion, parseJsonFromModelText } from '@/services/ai/jsonCompletion';
import { parseTaskSuggestions } from '@/utils/taskExtraction';

/** One request per entry keeps a burst of taps from stacking up. */
const inFlight = new Set<string>();

export const TASK_EXTRACTION_SYSTEM_PROMPT = [
    'You turn a journal entry into a short list of concrete tasks.',
    'Only include things the writer actually decided, meant to do, or clearly needs to do.',
    'Each task starts with a verb and stays under twelve words.',
    'Never include an emotion, a reflection, or a general theme as a task.',
    'If the entry implies no action, return an empty list.',
    'Return JSON only, shaped like {"tasks": ["...", "..."]}, with at most five tasks.',
].join(' ');

export interface ExtractTasksInput {
    entryText: string;
    /** Titles the writer already has, so they are not offered twice. */
    existing?: readonly string[];
}

/**
 * Pulls titles out of a model answer, accepting the shapes models actually
 * return: {"tasks": [...]}, a bare array, a fenced block, or a refusal in
 * prose. Anything unrecognised is no suggestions, not an error.
 */
function titlesFromAnswer(content: string): string[] {
    const stripped = content
        .replace(/^\s*```(?:json)?/i, '')
        .replace(/```\s*$/, '')
        .trim();
    const parsed = parseJsonFromModelText(stripped);
    if (parsed !== null) {
        const titles = parseTaskSuggestions(parsed);
        if (titles.length > 0) return titles;
    }
    // Some models answer with a plain numbered or bulleted list despite the
    // request for JSON; read those lines rather than throwing the answer away.
    return parseTaskSuggestions(
        stripped
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => /^(?:[-*•]|\d+[.)])\s+\S/.test(line)),
    );
}

/**
 * Returns task titles worth offering for this entry, or an empty list. Never
 * throws: a failed call is the same to the writer as "nothing to suggest".
 */
export async function extractTasksForEntry(input: ExtractTasksInput): Promise<string[]> {
    const text = input.entryText.trim();
    if (text.length < 24) return [];

    const key = text.slice(0, 512);
    if (inFlight.has(key)) return [];
    inFlight.add(key);
    try {
        const { content } = await fetchDirectJsonCompletion(
            {
                model: 'agent-default',
                messages: [
                    { role: 'system', content: TASK_EXTRACTION_SYSTEM_PROMPT },
                    { role: 'user', content: `Entry:\n${text}` },
                ],
                temperature: 0.2,
            },
            { modelPurpose: 'flash' },
        );
        return titlesFromAnswer(content);
    } catch {
        return [];
    } finally {
        inFlight.delete(key);
    }
}

/** Test seam: forget in-flight keys so a suite can re-run the same entry. */
export function resetTaskExtractionState(): void {
    inFlight.clear();
}
