import { buildWeekMoodStrip, formatMoodDayLabel } from '@/utils/moodStrip';
import { getLocalDateKeyFromTimestamp } from '@/utils/date';

const NOW = new Date(2026, 10, 8, 9, 30).getTime(); // Sunday 8 Nov 2026
const day = (offset: number) => new Date(2026, 10, 8 - offset, 18, 0).getTime();

function item(mood: string | undefined, at: number) {
    return { id: 'x-' + at, mood, createdAt: at };
}

describe('buildWeekMoodStrip', () => {
    it('returns seven cells ending today, oldest first', () => {
        const strip = buildWeekMoodStrip([], NOW);
        expect(strip).toHaveLength(7);
        expect(strip[6].dateKey).toBe(getLocalDateKeyFromTimestamp(NOW));
        expect(strip[0].dateKey).toBe(getLocalDateKeyFromTimestamp(day(6)));
        expect(strip.every((cell) => cell.mood === null)).toBe(true);
    });

    it('picks the mood word for a day without exposing emoji', () => {
        const strip = buildWeekMoodStrip([item('Calm 😌', day(0))], NOW);
        const today = strip[6];
        expect(today.mood).toBe('Calm');
        expect(today.hasWriting).toBe(true);
    });

    it('treats a day with no writing as empty, not as a bad mood', () => {
        const strip = buildWeekMoodStrip([item('Hopeful', day(0))], NOW);
        expect(strip[0].mood).toBeNull();
        expect(strip[0].hasWriting).toBe(false);
    });

    it('uses the latest writing of a day when there are several', () => {
        const strip = buildWeekMoodStrip(
            [item('Tender', day(1)), item('Proud', day(1) + 3600_000)],
            NOW,
        );
        expect(strip[5].mood).toBe('Proud');
        expect(strip[5].entryCount).toBe(2);
    });

    it('ignores moods from outside the week and unknown mood words', () => {
        const strip = buildWeekMoodStrip(
            [item('Proud', day(20)), item('   ', day(2)), item('Steady', day(2))],
            NOW,
        );
        expect(strip.map((cell) => cell.mood)).toEqual([null, null, null, null, 'Steady', null, null]);
    });
});

describe('formatMoodDayLabel', () => {
    it('names today and yesterday in plain words', () => {
        const strip = buildWeekMoodStrip([], NOW);
        expect(formatMoodDayLabel(strip[6], strip)).toBe('Today');
        expect(formatMoodDayLabel(strip[5], strip)).toBe('Yesterday');
        expect(formatMoodDayLabel(strip[4], strip)).toBe('Friday');
    });
});
