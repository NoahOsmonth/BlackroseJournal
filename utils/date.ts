/**
 * Local calendar helpers for AI clock + day digests.
 * All "day" keys use the device local timezone (not UTC).
 */

const WEEKDAY_NAMES = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
] as const;

const WEEKDAY_ALIASES: Record<string, number> = {
    sunday: 0,
    sun: 0,
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    tues: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    thur: 4,
    thurs: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
};

export function getLocalDateKey(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getLocalDateKeyFromTimestamp(timestamp: number): string {
    return getLocalDateKey(new Date(timestamp));
}

export function parseLocalDateKey(dateKey: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    const date = new Date(year, month - 1, day);
    if (
        date.getFullYear() !== year
        || date.getMonth() !== month - 1
        || date.getDate() !== day
    ) {
        return null;
    }
    return date;
}

export function addLocalDays(date: Date, deltaDays: number): Date {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + deltaDays);
    return next;
}

export function formatWeekdayName(date: Date): string {
    return WEEKDAY_NAMES[date.getDay()] ?? 'Unknown';
}

export function formatLocalTime(date: Date = new Date()): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

export function formatTimezoneOffset(date: Date = new Date()): string {
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMinutes);
    const hours = String(Math.floor(abs / 60)).padStart(2, '0');
    const minutes = String(abs % 60).padStart(2, '0');
    return `UTC${sign}${hours}:${minutes}`;
}

/**
 * Resolve relative or absolute day references to a local YYYY-MM-DD key.
 * Accepts: today, yesterday, tomorrow, YYYY-MM-DD, monday…sunday (most recent past).
 */
export function resolveRelativeDateKey(
    input: string,
    now: Date = new Date()
): string | null {
    const raw = input.trim().toLowerCase();
    if (!raw) return null;

    if (raw === 'today') return getLocalDateKey(now);
    if (raw === 'yesterday') return getLocalDateKey(addLocalDays(now, -1));
    if (raw === 'tomorrow') return getLocalDateKey(addLocalDays(now, 1));

    const absolute = parseLocalDateKey(raw);
    if (absolute) return getLocalDateKey(absolute);

    const weekday = WEEKDAY_ALIASES[raw];
    if (weekday !== undefined) {
        const today = now.getDay();
        let delta = today - weekday;
        if (delta <= 0) delta += 7;
        return getLocalDateKey(addLocalDays(now, -delta));
    }

    const lastWeekday = /^last\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)$/.exec(raw);
    if (lastWeekday) {
        const day = WEEKDAY_ALIASES[lastWeekday[1]];
        if (day === undefined) return null;
        const today = now.getDay();
        let delta = today - day;
        if (delta <= 0) delta += 7;
        return getLocalDateKey(addLocalDays(now, -delta));
    }

    return null;
}

/**
 * Markdown block injected into system prompts so the model knows local time.
 * Also carries write-day vs event-day doctrine (Test B day-slip fix).
 * Consumed via `features/chat/flows/index.ts` → `resolveClockContext` →
 * `composeHistoryContextBlocks` / `composeSystemPrompt`.
 */
export function buildClockContext(now: Date = new Date()): string {
    const dateKey = getLocalDateKey(now);
    const weekday = formatWeekdayName(now);
    const time = formatLocalTime(now);
    const tz = formatTimezoneOffset(now);
    return [
        '## Clock',
        `Local date: ${dateKey} (${weekday})`,
        `Local time: ${time}`,
        `Timezone offset: ${tz}`,
        'Use this clock to resolve "today", "yesterday", "last week", and weekday names. Do not invent dates.',
        '',
        '## Date doctrine (write day vs event day)',
        'Dates labeled on past entries, digests, session recall lines, and memory capsule lines (e.g. "Written YYYY-MM-DD") are when those items were WRITTEN or finished on this device — not when life events described in the prose occurred.',
        "Weekday and calendar names in the user's own words are authoritative for event timing. Resolve them against this clock (most recent past occurrence unless clearly future). Prefer absolute YYYY-MM-DD over relative phrases when you state when something happened.",
        'Never call an event "today" or "yesterday" unless its resolved date matches this clock. Never say "the day before", "the day after", or similar unless the arithmetic actually holds for the absolute dates you state.',
    ].join('\n');
}
