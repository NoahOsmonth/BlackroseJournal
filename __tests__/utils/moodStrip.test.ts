import { buildWeekMoodStrip, formatMoodDayLabel } from '@/utils/moodStrip';
import { getLocalDateKeyFromTimestamp } from '@/utils/date';

const NOW = new Date(2026, 10, 8, 9, 30).getTime(); // Sunday 8 Nov 2026
const day = (offset: number) => new Date(2026, 10, 8 - offset, 18, 0).getTime();

function item(mood: string | undefined, at: number) {
    return { id: 'x-' + at, mood, createdAt: at };
}

describe('buildWeekMoodStrip', () => {
    // The strip is the CALENDAR week (Sun-Sat) containing `now`, matching the
    // "This week" header above it. It used to be a rolling last-seven-days
    // window, which on Sunday 8 Nov showed 2-8 Nov under a header reading
    // "Nov 8-14" - and counted the previous week's moods.
    it('returns the seven days of the calendar week, Sunday first', () => {
        const strip = buildWeekMoodStrip([], NOW);
        expect(strip).toHaveLength(7);
        expect(strip[0].dateKey).toBe(getLocalDateKeyFromTimestamp(NOW));
        expect(strip[6].dateKey).toBe(getLocalDateKeyFromTimestamp(day(-6)));
        expect(strip.every((cell) => cell.mood === null)).toBe(true);
    });

    it('anchors on the week containing now, not on today', () => {
        // Wednesday 11 Nov belongs to the same Sun-Sat week as Sunday 8 Nov.
        const midweek = new Date(2026, 10, 11, 9, 30).getTime();
        const strip = buildWeekMoodStrip([], midweek);

        expect(strip[0].dateKey).toBe('2026-11-08');
        expect(strip[6].dateKey).toBe('2026-11-14');
    });

    it('picks the mood word for a day without exposing emoji', () => {
        const strip = buildWeekMoodStrip([item('Calm 😌', day(0))], NOW);
        const today = strip[0];
        expect(today.mood).toBe('Calm');
        expect(today.hasWriting).toBe(true);
    });

    it('treats a day with no writing as empty, not as a bad mood', () => {
        const strip = buildWeekMoodStrip([item('Hopeful', day(0))], NOW);
        expect(strip[1].mood).toBeNull();
        expect(strip[1].hasWriting).toBe(false);
    });

    it('uses the latest writing of a day when there are several', () => {
        const strip = buildWeekMoodStrip(
            [item('Tender', day(0)), item('Proud', day(0) + 3600_000)],
            NOW,
        );
        expect(strip[0].mood).toBe('Proud');
        expect(strip[0].entryCount).toBe(2);
    });

    it('ignores moods from outside the week and unknown mood words', () => {
        const strip = buildWeekMoodStrip(
            [item('Proud', day(-20)), item('   ', day(-2)), item('Steady', day(-2))],
            NOW,
        );
        expect(strip.map((cell) => cell.mood)).toEqual([null, null, 'Steady', null, null, null, null]);
    });
});

describe('formatMoodDayLabel', () => {
    it('names today and yesterday in plain words', () => {
        const strip = buildWeekMoodStrip([], NOW);
        expect(formatMoodDayLabel(strip[0], strip, NOW)).toBe('Today');
        // The rest of the week has not happened yet, so it is named by weekday.
        expect(formatMoodDayLabel(strip[1], strip, NOW)).toBe('Monday');
        expect(formatMoodDayLabel(strip[5], strip, NOW)).toBe('Friday');
    });
});
