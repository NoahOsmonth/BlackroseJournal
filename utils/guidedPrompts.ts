/**
 * Guided prompts (Kaneo #13).
 *
 * A small shelf of starting points for someone who opened the app and did not
 * know what to write. Each prompt is a door, not a form: tapping one opens the
 * chat with a first line already in it, so the writer can change it or send it.
 *
 * Pure — no storage, no clock, no I/O. Picking which prompts to offer today is
 * deterministic from the date, so the shelf rotates without being random.
 */

export type PromptMood = 'morning' | 'evening' | 'anytime';

export interface GuidedPrompt {
    readonly id: string;
    /** The line dropped into the chat input. Written in the writer's voice. */
    readonly opening: string;
    /** Short label for the shelf. */
    readonly label: string;
    /** When this prompt tends to fit. */
    readonly mood: PromptMood;
}

export const GUIDED_PROMPTS: readonly GuidedPrompt[] = [
    { id: 'one-thing', label: 'One thing', mood: 'anytime', opening: 'One thing on my mind right now is' },
    { id: 'small-win', label: 'A small win', mood: 'evening', opening: 'Something small that went right today was' },
    { id: 'body', label: 'In my body', mood: 'anytime', opening: 'Right now my body feels' },
    { id: 'unfinished', label: 'Still sitting with me', mood: 'evening', opening: 'The thing I am still sitting with is' },
    { id: 'tomorrow', label: 'Tomorrow', mood: 'evening', opening: 'What I want tomorrow to hold is' },
    { id: 'grateful', label: 'Something good', mood: 'anytime', opening: 'Something I am glad about today is' },
    { id: 'hard', label: 'The hard part', mood: 'evening', opening: 'The hard part of today was' },
    { id: 'morning-plan', label: 'This morning', mood: 'morning', opening: 'This morning I want to make space for' },
    { id: 'worry', label: 'A worry', mood: 'anytime', opening: 'Something I keep worrying about is' },
    { id: 'person', label: 'Someone on my mind', mood: 'anytime', opening: 'Someone I keep thinking about is' },
    { id: 'change', label: 'Something changing', mood: 'anytime', opening: 'Something in me seems to be changing: ' },
    { id: 'night', label: 'Before sleep', mood: 'evening', opening: 'As the day ends, I notice' },
] as const;

/** Morning / evening from the hour; anything else is 'anytime'. */
export function moodForHour(hour: number): PromptMood {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 17 || hour < 5) return 'evening';
    return 'anytime';
}

/**
 * Which prompts to show today.
 *
 * The prompts that fit the hour come first, then the anytime ones, then the
 * rest — and the whole shelf is rotated by the day so the same three are not
 * offered every single time. Rotation is by date key, so it is stable within a
 * day (no reshuffle on every re-render) and changes tomorrow.
 */
export function promptsForDay(todayKey: string, mood: PromptMood, count = 4): GuidedPrompt[] {
    const fit = (p: GuidedPrompt): number => (p.mood === mood ? 0 : p.mood === 'anytime' ? 1 : 2);
    const ordered = [...GUIDED_PROMPTS]
        .map((prompt, index) => ({ prompt, index }))
        .sort((a, b) => fit(a.prompt) - fit(b.prompt) || a.index - b.index)
        .map((entry) => entry.prompt);

    const seed = daySeed(todayKey);
    const offset = ordered.length === 0 ? 0 : seed % ordered.length;
    const rotated = [...ordered.slice(offset), ...ordered.slice(0, offset)];
    // Re-sort so the hour still wins; rotation only shuffles within a tier.
    rotated.sort((a, b) => fit(a) - fit(b));
    return rotated.slice(0, Math.max(0, count));
}

/** Stable small integer from a YYYY-MM-DD key. */
function daySeed(key: string): number {
    let seed = 0;
    for (let i = 0; i < key.length; i += 1) {
        seed = (seed * 31 + key.charCodeAt(i)) % 100000;
    }
    return seed;
}

/** Every prompt, grouped for a browse list. */
export function promptsByMood(mood: PromptMood): GuidedPrompt[] {
    return GUIDED_PROMPTS.filter((p) => p.mood === mood || p.mood === 'anytime');
}
