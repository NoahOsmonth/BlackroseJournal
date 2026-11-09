/**
 * What the day-feeling store adds up to (Kaneo #99).
 *
 * Pure: takes the map, returns a summary. The rules matter more than the maths,
 * because a confident wrong insight is worse than no insight at all:
 *
 * - A cause needs MIN_DAYS_FOR_LEAN days behind it before it may be named.
 * - A cause is only named when it leans clearly (LEAN_SHARE of the days on one
 *   side, and a third or less on the other). A 50/50 cause says nothing.
 * - Counts, never percentages: "3 of 4" reads as counting, "75%" reads as
 *   science.
 * - A day with no feeling is skipped, never treated as neutral.
 */
import { DayMood } from '@/services/journal/dayMood';
import { DAY_FACTORS, factorLabelFor, moodLabelFor } from '@/utils/dayMood';
import { getLocalDateKey, parseLocalDateKey } from '@/utils/date';

export const INSIGHT_WINDOW_DAYS = 28;
export const MIN_DAYS_FOR_LEAN = 4;
const LEAN_SHARE = 0.6;
const OTHER_SHARE_MAX = 0.34;

/** Feelings that read as an easier day, and ones that read as harder. */
const LIGHTER = ['light', 'calm'];
const HEAVIER = ['heavy', 'restless'];

export interface CauseCount {
    readonly id: string;
    readonly label: string;
    readonly count: number;
}

export interface MoodSide {
    readonly days: number;
    readonly causes: readonly CauseCount[];
}

export interface DayMoodInsight {
    readonly recordedDays: number;
    readonly windowDays: number;
    /** True once there is anything at all worth showing. */
    readonly hasAnything: boolean;
    /** The one sentence, or null when the counts do not support one. */
    readonly leanLine: string | null;
    readonly lighter: MoodSide;
    readonly heavier: MoodSide;
}

function daysBack(todayKey: string, windowDays: number): string[] {
    const base = parseLocalDateKey(todayKey) ?? new Date();
    const keys: string[] = [];
    for (let i = 0; i < windowDays; i += 1) {
        const day = new Date(base);
        day.setDate(base.getDate() - i);
        keys.push(getLocalDateKey(day));
    }
    return keys;
}

function countCauses(entries: readonly DayMood[]): CauseCount[] {
    const totals = new Map<string, number>();
    for (const entry of entries) {
        for (const id of entry.factorIds) totals.set(id, (totals.get(id) ?? 0) + 1);
    }
    return DAY_FACTORS
        .filter((factor) => (totals.get(factor.id) ?? 0) > 0)
        .map((factor) => ({ id: factor.id, label: factor.label, count: totals.get(factor.id) ?? 0 }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function buildDayMoodInsight(
    days: Readonly<Record<string, DayMood>>,
    todayKey: string,
    windowDays: number = INSIGHT_WINDOW_DAYS,
): DayMoodInsight {
    const keys = daysBack(todayKey, windowDays);
    const inWindow: DayMood[] = [];
    for (const key of keys) {
        const entry = days[key];
        if (entry) inWindow.push(entry);
    }
    const lighterEntries = inWindow.filter((entry) => entry.moodId && LIGHTER.includes(entry.moodId));
    const heavierEntries = inWindow.filter((entry) => entry.moodId && HEAVIER.includes(entry.moodId));

    const lighter: MoodSide = { days: lighterEntries.length, causes: countCauses(lighterEntries) };
    const heavier: MoodSide = { days: heavierEntries.length, causes: countCauses(heavierEntries) };

    return {
        recordedDays: inWindow.length,
        windowDays,
        hasAnything: inWindow.length > 0,
        leanLine: buildLeanLine(lighter, heavier),
        lighter,
        heavier,
    };
}

/**
 * The sentence, or null. Both sides need enough days, and the cause has to be
 * common on one side and uncommon on the other - otherwise "People" would be
 * named as lifting days even when it shows up equally often on hard ones.
 */
function buildLeanLine(lighter: MoodSide, heavier: MoodSide): string | null {
    if (lighter.days < MIN_DAYS_FOR_LEAN || heavier.days < MIN_DAYS_FOR_LEAN) return null;

    const lightTop = lighter.causes.find((cause) => {
        const other = heavier.causes.find((each) => each.id === cause.id)?.count ?? 0;
        return cause.count / lighter.days >= LEAN_SHARE && other / heavier.days <= OTHER_SHARE_MAX;
    });
    if (lightTop) {
        return 'On ' + lightTop.count + ' of your ' + lighter.days + ' lighter days, ' +
            lightTop.label + ' was in the mix.';
    }

    const heavyTop = heavier.causes.find((cause) => {
        const other = lighter.causes.find((each) => each.id === cause.id)?.count ?? 0;
        return cause.count / heavier.days >= LEAN_SHARE && other / lighter.days <= OTHER_SHARE_MAX;
    });
    if (heavyTop) {
        return 'On ' + heavyTop.count + ' of your ' + heavier.days + ' heavier days, ' +
            heavyTop.label + ' was in the mix.';
    }

    return null;
}

/** Plain summary of one side, for the card's two columns. */
export function sideSummary(side: MoodSide): string {
    if (side.days === 0) return 'No days yet';
    if (side.causes.length === 0) return side.days + (side.days === 1 ? ' day, nothing named' : ' days, nothing named');
    const named = side.causes.slice(0, 3).map((cause) => cause.label).join(', ');
    return side.days + (side.days === 1 ? ' day: ' : ' days: ') + named;
}

/** Labels for the two sides, kept here so the card never invents copy. */
export const SIDE_LABELS = {
    lighter: 'Lighter days',
    heavier: 'Heavier days',
} as const;

export function feelingLabel(id: string | null): string {
    return id ? moodLabelFor(id) : '';
}

export function causeLabel(id: string): string {
    return factorLabelFor(id);
}
