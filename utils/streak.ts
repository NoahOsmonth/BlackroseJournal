import type { JournalEntry } from '@/services/journalStorage.types';

function dayKeyForTimezone(date: Date, timeZoneOffsetMinutes: number): string {
    // Convert `date` to a stable day key using the supplied timezone offset.
    // `Date#getTimezoneOffset()` is defined as UTC - local (in minutes).
    // Shifting by this value lets us derive a YYYY-MM-DD key in that timezone
    // via UTC ISO formatting.
    const shifted = new Date(date.getTime() - timeZoneOffsetMinutes * 60 * 1000);
    return shifted.toISOString().slice(0, 10);
}

/**
 * Calculates the current streak (consecutive days with at least one completed entry)
 * ending on the provided reference date.
 *
 * By default, streaks are calculated using UTC day boundaries to keep the result
 * deterministic across environments. If you want "local calendar day" semantics,
 * pass the user's timezone offset (e.g. `new Date().getTimezoneOffset()`).
 */
export function calculateCurrentStreak(
    entries: JournalEntry[],
    referenceDate: Date = new Date(),
    timeZoneOffsetMinutes: number = 0
): number {
    const daysWithEntries = new Set<string>();

    entries.forEach((entry) => {
        const date = new Date(entry.createdAt);
        daysWithEntries.add(dayKeyForTimezone(date, timeZoneOffsetMinutes));
    });

    let streak = 0;
    const checkDate = new Date(referenceDate);

    while (daysWithEntries.has(dayKeyForTimezone(checkDate, timeZoneOffsetMinutes))) {
        streak += 1;
        checkDate.setDate(checkDate.getDate() - 1);
    }

    return streak;
}
