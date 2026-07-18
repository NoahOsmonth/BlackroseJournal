import {
    addLocalDays,
    buildClockContext,
    formatEventDateLabel,
    getLocalDateKey,
    getLocalDateKeyFromTimestamp,
    normalizeEventDate,
    parseLocalDateKey,
    resolveRelativeDateKey,
    resolveUpcomingWeekdayKey,
} from '../../utils/date';

describe('utils/date', () => {
    const fixed = new Date(2026, 6, 13, 14, 32, 0); // Mon 2026-07-13 local

    it('formats local date keys', () => {
        expect(getLocalDateKey(fixed)).toBe('2026-07-13');
        expect(getLocalDateKeyFromTimestamp(fixed.getTime())).toBe('2026-07-13');
    });

    it('parses valid and rejects invalid date keys', () => {
        expect(parseLocalDateKey('2026-07-13')?.getDate()).toBe(13);
        expect(parseLocalDateKey('2026-02-30')).toBeNull();
        expect(parseLocalDateKey('nope')).toBeNull();
    });

    it('resolves today / yesterday / tomorrow', () => {
        expect(resolveRelativeDateKey('today', fixed)).toBe('2026-07-13');
        expect(resolveRelativeDateKey('yesterday', fixed)).toBe('2026-07-12');
        expect(resolveRelativeDateKey('tomorrow', fixed)).toBe('2026-07-14');
    });

    it('resolves absolute keys and weekdays to the most recent past occurrence', () => {
        expect(resolveRelativeDateKey('2026-07-01', fixed)).toBe('2026-07-01');
        // fixed is Monday → last Sunday is previous day
        expect(resolveRelativeDateKey('sunday', fixed)).toBe('2026-07-12');
        expect(resolveRelativeDateKey('last friday', fixed)).toBe('2026-07-10');
    });

    it('adds local days without UTC shift', () => {
        expect(getLocalDateKey(addLocalDays(fixed, -1))).toBe('2026-07-12');
    });

    it('builds a clock context block with the local date and write-day doctrine', () => {
        const clock = buildClockContext(fixed);
        expect(clock).toContain('## Clock');
        expect(clock).toContain('Local date: 2026-07-13 (Monday)');
        expect(clock).toContain('Local time: 14:32');
        expect(clock).toContain('Timezone offset:');
        // Day-slip doctrine — sabotage: remove these lines from buildClockContext → red
        expect(clock).toContain('## Date doctrine (write day vs event day)');
        expect(clock).toContain('WRITTEN');
        expect(clock).toMatch(/user'?s own words are authoritative/i);
        expect(clock).toContain('Never call an event "today"');
        // Stored Event labels are authoritative — sabotage: drop this line from buildClockContext → red
        expect(clock).toContain('When an "Event: YYYY-MM-DD" label is present');
        expect(clock).toMatch(/authoritative for when the event occurs/i);
    });

    it('resolves upcoming Friday from Saturday write-day (event-oriented, not past)', () => {
        const saturday = new Date(2026, 6, 18, 14, 0, 0); // Sat 2026-07-18
        expect(resolveUpcomingWeekdayKey('friday', saturday)).toBe('2026-07-24');
        expect(normalizeEventDate('Friday', saturday)).toBe('2026-07-24');
        expect(normalizeEventDate('2026-07-24', saturday)).toBe('2026-07-24');
        expect(normalizeEventDate('tomorrow', saturday)).toBe('2026-07-19');
        expect(normalizeEventDate(null, saturday)).toBeNull();
        expect(normalizeEventDate('not-a-date', saturday)).toBeNull();
        expect(formatEventDateLabel('2026-07-24')).toBe('Event: 2026-07-24 (Fri)');
    });

    /**
     * Anti-regression for classic UTC day-slip near local midnight.
     * Device-local keys must use local Y/M/D, not Date#toISOString().
     * What would make this fail: getLocalDateKey using toISOString().slice(0,10).
     */
    it('does not shift the calendar day via UTC near local midnight (positive offset TZ)', () => {
        const localMidnightish = new Date(2026, 6, 18, 0, 30, 0); // Sat 00:30 device local
        const localKey = getLocalDateKey(localMidnightish);
        const utcKey = localMidnightish.toISOString().slice(0, 10);
        expect(localKey).toBe('2026-07-18');
        // On UTC+ offsets, ISO date can be the previous calendar day — that is the bug we refuse.
        if (localMidnightish.getTimezoneOffset() < 0) {
            expect(utcKey).not.toBe(localKey);
        }
        expect(getLocalDateKeyFromTimestamp(localMidnightish.getTime())).toBe(localKey);
    });

    /**
     * Test B setup: journaling on Saturday about an event "on Sunday".
     * Clock correctly reports write-day Saturday; event Sunday is not a structured field.
     */
    it('clock reports write-day weekday (Saturday) independent of prose event days', () => {
        const saturday = new Date(2026, 6, 18, 14, 30, 0);
        const clock = buildClockContext(saturday);
        expect(clock).toContain('Local date: 2026-07-18 (Saturday)');
        // Most recent past Sunday from that Saturday is 2026-07-12
        expect(resolveRelativeDateKey('sunday', saturday)).toBe('2026-07-12');
    });
});
