/**
 * Turns an entry into a short list of tasks the writer could act on.
 *
 * Pure: the model call and any storage write live elsewhere. These helpers only
 * clean what the model said and drop what the writer already has, so the same
 * input always produces the same list and the screen cannot show a duplicate.
 */

/** How many tasks one entry may offer. More than this is a wall, not a help. */
export const TASK_PROPOSAL_LIMIT = 5;

/** Longest title a task may carry; past this it is a sentence, not a task. */
export const TASK_TITLE_MAX = 90;

const LEADING_DECORATION = /^\s*(?:[-*•]|\d+[.)]|\(?[a-z]\)|\[[ xX]\])\s*/;
const TRAILING_PERIOD = /[.。]+$/;

/**
 * Tidies one suggestion into a task title. Returns null for anything that is
 * not a usable title (blank, or long enough to be a paragraph).
 */
export function cleanTaskTitle(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    let text = raw.replace(/\s+/g, ' ').trim();
    // Models like to add their own bullets and checkboxes.
    let previous = '';
    while (previous !== text) {
        previous = text;
        text = text.replace(LEADING_DECORATION, '').trim();
    }
    // A task reads as an action, so drop the full stop but keep a question.
    text = text.replace(TRAILING_PERIOD, '').trim();
    if (!text) return null;
    if (text.length > TASK_TITLE_MAX) return null;
    return text;
}

/**
 * Pulls titles out of whatever shape the model returned: a bare array, an
 * array of objects, or an object with a tasks key. Never throws.
 */
export function parseTaskSuggestions(value: unknown): string[] {
    const list = Array.isArray(value)
        ? value
        : isRecord(value) && Array.isArray(value.tasks)
            ? value.tasks
            : [];
    const titles: string[] = [];
    for (const item of list) {
        const candidate = typeof item === 'string'
            ? item
            : isRecord(item)
                ? item.title ?? item.task ?? item.text
                : null;
        const title = cleanTaskTitle(candidate);
        if (title) titles.push(title);
        if (titles.length >= TASK_PROPOSAL_LIMIT) break;
    }
    return titles;
}

/**
 * Removes suggestions the writer already has. Matching is deliberately loose on
 * punctuation and case but strict on words: "Call the dentist" and "call the
 * plumber" are different tasks and both are kept.
 */
export function dedupeTasks(existing: readonly string[], suggestions: readonly string[]): string[] {
    const seen = new Set(existing.map(comparableKey));
    const kept: string[] = [];
    for (const suggestion of suggestions) {
        const title = cleanTaskTitle(suggestion);
        if (!title) continue;
        const key = comparableKey(title);
        if (seen.has(key)) continue;
        seen.add(key);
        kept.push(title);
    }
    return kept;
}

function comparableKey(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^\p{L}\p{N} ]+/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
