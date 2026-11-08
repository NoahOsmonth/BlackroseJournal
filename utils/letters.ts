/**
 * Letters to your future self (Kaneo #11).
 *
 * You write now; it stays sealed until a day you pick. Nothing unlocks early,
 * so this module owns the whole rule set: when a letter is readable, what the
 * list may say about a sealed letter, and how to describe the wait in plain
 * words. Pure — no storage, no clock of its own.
 */

export interface LetterRecord {
    readonly id: string;
    /** The writer's words. Never shown before `unlockDate`. */
    readonly body: string;
    /** Local date key (YYYY-MM-DD) the letter becomes readable. */
    readonly unlockDate: string;
    /** Local date key the letter was written. */
    readonly writtenDate: string;
    readonly createdAt: number;
}

/**
 * True once the unlock day has arrived. Compared as plain date keys, so a
 * letter unlocks at the start of its day wherever the writer is — the same rule
 * the rest of the app uses for days, and no timezone maths to get wrong.
 */
export function isLetterUnlocked(unlockDate: string, todayKey: string): boolean {
    return unlockDate <= todayKey;
}

/** Whole days from today until the letter opens. 0 means today. */
export function daysUntilUnlock(unlockDate: string, todayKey: string): number {
    const toUtc = (key: string): number | null => {
        const [y, m, d] = key.split('-').map(Number);
        if (!y || !m || !d) return null;
        return Date.UTC(y, m - 1, d);
    };
    const a = toUtc(unlockDate);
    const b = toUtc(todayKey);
    if (a === null || b === null) return 0;
    return Math.max(0, Math.round((a - b) / 86400000));
}

/** "Today", "Tomorrow", "in 3 days", "in 2 months" — never a raw date. */
export function describeUnlock(unlockDate: string, todayKey: string): string {
    const days = daysUntilUnlock(unlockDate, todayKey);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 7) return `in ${days} days`;
    if (days < 60) {
        const weeks = Math.round(days / 7);
        return weeks === 1 ? 'in a week' : `in ${weeks} weeks`;
    }
    const months = Math.round(days / 30);
    return months <= 1 ? 'in a month' : `in ${months} months`;
}

/** A sealed letter gives away nothing but how long the wait is. */
export interface LetterListEntry {
    readonly id: string;
    readonly unlockDate: string;
    readonly writtenDate: string;
    readonly isUnlocked: boolean;
    /** Present only once unlocked. */
    readonly body?: string;
    readonly unlockLabel: string;
}

export function toListEntries(letters: readonly LetterRecord[], todayKey: string): LetterListEntry[] {
    return [...letters]
        .sort((a, b) => a.unlockDate.localeCompare(b.unlockDate))
        .map((letter) => {
            const isUnlocked = isLetterUnlocked(letter.unlockDate, todayKey);
            return {
                id: letter.id,
                unlockDate: letter.unlockDate,
                writtenDate: letter.writtenDate,
                isUnlocked,
                ...(isUnlocked ? { body: letter.body } : {}),
                unlockLabel: isUnlocked ? 'Opened' : describeUnlock(letter.unlockDate, todayKey),
            };
        });
}

export interface LetterDraftIssue {
    readonly message: string;
}

/** Why a letter cannot be sealed yet, in the writer's words. Null when it can. */
export function letterDraftIssue(body: string, unlockDate: string, todayKey: string): LetterDraftIssue | null {
    if (body.trim().length === 0) {
        return { message: 'Write something first, even a line.' };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(unlockDate)) {
        return { message: 'Pick the day this should open.' };
    }
    if (daysUntilUnlock(unlockDate, todayKey) === 0) {
        return { message: 'A letter needs a day in the future to open.' };
    }
    return null;
}
