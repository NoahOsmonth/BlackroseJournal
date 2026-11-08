/**
 * Themed starter packs (Kaneo #83). Fresh 2026 research: Day One ships
 * "curated collections of themed journal prompts" with favorites and a
 * quick-access tab. Today already shows three rotating starters; this shelf
 * lets a writer browse ALL of them by theme and keep their favorites.
 *
 * Pure: no I/O, no hooks, no clock. Reuses GuidedPrompt from guidedPrompts
 * so the two surfaces can never disagree about an opening line.
 */
import { GUIDED_PROMPTS, type GuidedPrompt } from '@/utils/guidedPrompts';

export interface PromptPack {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly promptIds: readonly string[];
}

/** One stable order, defined by id so a rename cannot reshuffle the shelf. */
export const PROMPT_PACKS: readonly PromptPack[] = [
    {
        id: 'quiet-start',
        title: 'A quiet start',
        description: 'Small openings for a blank page.',
        promptIds: ['one-thing', 'body', 'morning-plan', 'change'],
    },
    {
        id: 'looking-back',
        title: 'Looking back',
        description: 'Ways to notice what the day held.',
        promptIds: ['small-win', 'night', 'tomorrow', 'hard'],
    },
    {
        id: 'glad-about',
        title: 'Things I am glad about',
        description: 'A little room for what went right.',
        promptIds: ['grateful', 'small-win', 'person', 'one-thing'],
    },
    {
        id: 'hard-days',
        title: 'On hard days',
        description: 'Gentle openings when words are heavy.',
        promptIds: ['hard', 'worry', 'unfinished', 'body'],
    },
    {
        id: 'about-people',
        title: 'About people',
        description: 'The ones who keep showing up in your writing.',
        promptIds: ['person', 'worry', 'grateful', 'change'],
    },
] as const;

export function packById(id: string): PromptPack | undefined {
    return PROMPT_PACKS.find((pack) => pack.id === id);
}

/** Resolve a pack's ids to real prompts; unknown ids are dropped. */
export function promptsInPack(pack: PromptPack): readonly GuidedPrompt[] {
    return pack.promptIds
        .map((id) => GUIDED_PROMPTS.find((prompt) => prompt.id === id))
        .filter((prompt): prompt is GuidedPrompt => Boolean(prompt));
}

/** Every distinct starter across every pack, in shelf order. */
export function allPackPrompts(): readonly GuidedPrompt[] {
    const seen = new Set<string>();
    const result: GuidedPrompt[] = [];
    for (const pack of PROMPT_PACKS) {
        for (const prompt of promptsInPack(pack)) {
            if (seen.has(prompt.id)) continue;
            seen.add(prompt.id);
            result.push(prompt);
        }
    }
    return result;
}

/** A saved-starter id is only valid if a real prompt owns it. */
export function isKnownPromptId(id: string): boolean {
    return GUIDED_PROMPTS.some((prompt) => prompt.id === id) || id.startsWith('theme-');
}

/**
 * Safe read of saved favorites: drop blanks, duplicates and unknown ids.
 * A corrupt or future payload can never put a stray row on the shelf.
 */
export function normalizeSavedPromptIds(value: unknown): readonly string[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of value) {
        if (typeof raw !== 'string') continue;
        const id = raw.trim();
        if (!id || seen.has(id) || !isKnownPromptId(id)) continue;
        seen.add(id);
        result.push(id);
    }
    return result;
}

/** Favorites that still resolve to a real, currently-offered starter. */
export function savedPrompts(ids: readonly string[]): readonly GuidedPrompt[] {
    return ids
        .map((id) => GUIDED_PROMPTS.find((prompt) => prompt.id === id))
        .filter((prompt): prompt is GuidedPrompt => Boolean(prompt));
}
