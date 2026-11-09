/**
 * The words a writer can use to say how a day felt, and what shaped it
 * (Kaneo #98). Pure: no storage, no side effects.
 *
 * Plain language only - these are the words someone would use out loud, not
 * scores or sentiment labels.
 */

export interface DayMoodOption {
    readonly id: string;
    readonly label: string;
}

export const DAY_MOODS: readonly DayMoodOption[] = [
    { id: 'light', label: 'Light' },
    { id: 'calm', label: 'Calm' },
    { id: 'mixed', label: 'Mixed' },
    { id: 'heavy', label: 'Heavy' },
    { id: 'restless', label: 'Restless' },
];

/** Everyday causes, not clinical categories. */
export const DAY_FACTORS: readonly DayMoodOption[] = [
    { id: 'people', label: 'People' },
    { id: 'work', label: 'Work' },
    { id: 'rest', label: 'Rest' },
    { id: 'sleep', label: 'Sleep' },
    { id: 'health', label: 'Health' },
    { id: 'movement', label: 'Movement' },
    { id: 'money', label: 'Money' },
    { id: 'home', label: 'Home' },
    { id: 'weather', label: 'Weather' },
    { id: 'making', label: 'Making something' },
];

/**
 * Six is a deliberate cap: past that the row stops being a quick note and
 * starts being a form, and a day that lists everything explains nothing.
 */
export const MAX_DAY_FACTORS = 6;

const MOOD_IDS = new Set(DAY_MOODS.map((mood) => mood.id));
const FACTOR_IDS = new Set(DAY_FACTORS.map((factor) => factor.id));

/** YYYY-MM-DD only. A bad key would silently scatter the store. */
export function isDayKey(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Returns the id when it is one we offer, otherwise null. */
export function normalizeMoodId(value: unknown): string | null {
    return typeof value === 'string' && MOOD_IDS.has(value) ? value : null;
}

/** Unknown ids are dropped, duplicates collapse, order follows the offer. */
export function normalizeFactorIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    for (const raw of value) {
        if (typeof raw === 'string' && FACTOR_IDS.has(raw)) seen.add(raw);
    }
    return DAY_FACTORS.filter((factor) => seen.has(factor.id))
        .map((factor) => factor.id)
        .slice(0, MAX_DAY_FACTORS);
}

export function moodLabelFor(id: string): string {
    return DAY_MOODS.find((mood) => mood.id === id)?.label ?? '';
}

export function factorLabelFor(id: string): string {
    return DAY_FACTORS.find((factor) => factor.id === id)?.label ?? '';
}
