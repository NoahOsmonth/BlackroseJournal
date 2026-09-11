/**
 * Threads time-range rail vocabulary.
 *
 * The concept (black-rose-threads.png) shows a single hairline rail labelled
 * "All time" with five graduation ticks and the handle resting at the wide end.
 * These stops are the pure data behind that rail — narrowest window first, so a
 * stop index maps straight onto a tick position.
 */
export interface MemoryRangeStop {
    readonly key: string;
    readonly label: string;
    /** Window length in days; `null` means no cutoff (all time). */
    readonly days: number | null;
}

export const MEMORY_RANGE_STOPS: readonly MemoryRangeStop[] = [
    { key: 'month', label: '1 month', days: 30 },
    { key: 'quarter', label: '3 months', days: 90 },
    { key: 'half-year', label: '6 months', days: 180 },
    { key: 'year', label: '1 year', days: 365 },
    { key: 'all', label: 'All time', days: null },
];

/** Default is the widest window — the handle rests at the right end. */
export const MEMORY_RANGE_DEFAULT_INDEX = MEMORY_RANGE_STOPS.length - 1;

/** Clamp any external index into the rail's range. */
export function memoryRangeStopAt(index: number): MemoryRangeStop {
    const clamped = Math.min(Math.max(Math.round(index), 0), MEMORY_RANGE_STOPS.length - 1);
    return MEMORY_RANGE_STOPS[clamped];
}

/** Position of a stop on the rail as 0–1, for the tick and handle offsets. */
export function memoryRangeRatio(index: number): number {
    const span = MEMORY_RANGE_STOPS.length - 1;
    if (span <= 0) return 0;
    const clamped = Math.min(Math.max(Math.round(index), 0), span);
    return clamped / span;
}
