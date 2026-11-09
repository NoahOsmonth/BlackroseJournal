/**
 * The last thirty days as a strip (Kaneo #104).
 *
 * Pure: given the stored day moods and today's key, say what each of the last
 * thirty days looked like. Oldest first, so the strip reads left to right like a
 * calendar.
 *
 * A day with nothing recorded is NOT dropped. A gap is information - it says the
 * writer skipped a day - and hiding it would make a month look shorter than it is.
 */
import { DAY_MOODS, moodLabelFor, normalizeMoodId } from '@/utils/dayMood';

export const MOOD_STRIP_DAYS = 30;

export interface MoodStripCell {
    dateKey: string;
    /** 1-based position in the strip, oldest first. */
    position: number;
    moodId: string | null;
    /** Plain words for a screen reader, e.g. "Nov 9: Heavy". */
    label: string;
    /** Ramp step 1..5, or null when nothing was recorded. */
    step: number | null;
}

const STEP_BY_MOOD: Record<string, number> = DAY_MOODS.reduce<Record<string, number>>(
    (steps, mood, index) => ({ ...steps, [mood.id]: index + 1 }),
    {},
);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shiftDays(dateKey: string, delta: number): string {
    const parts = dateKey.split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    date.setDate(date.getDate() + delta);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + month + '-' + day;
}

function shortLabel(dateKey: string): string {
    const parts = dateKey.split('-').map(Number);
    return MONTHS[parts[1] - 1] + ' ' + parts[2];
}

export function buildMoodStrip(
    days: Record<string, { moodId: string | null }>,
    todayKey: string,
    count: number = MOOD_STRIP_DAYS,
): MoodStripCell[] {
    const cells: MoodStripCell[] = [];
    for (let offset = count - 1; offset >= 0; offset -= 1) {
        const dateKey = shiftDays(todayKey, -offset);
        // An id this build does not know is not a feeling: a stored leftover must
        // read as "no entry", never as a raw id on screen (rule 13).
        const moodId = normalizeMoodId(days[dateKey]?.moodId);
        const step = moodId ? STEP_BY_MOOD[moodId] ?? null : null;
        cells.push({
            dateKey,
            position: count - offset,
            moodId,
            step,
            label: moodId
                ? shortLabel(dateKey) + ': ' + moodLabelFor(moodId)
                : shortLabel(dateKey) + ': no entry',
        });
    }
    return cells;
}

/** How many of the cells actually carry a feeling. */
export function recordedCells(cells: readonly MoodStripCell[]): number {
    return cells.filter((cell) => cell.moodId !== null).length;
}
