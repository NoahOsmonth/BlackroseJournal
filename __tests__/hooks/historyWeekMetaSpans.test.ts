/**
 * The Archive header used to print a bare "This week · Nov 8–14" above a feed
 * that lists every entry ever written (it runs back to 30 Oct in the demo
 * data). The line read as a filter the screen never applies.
 *
 * It now says "This week and earlier" when the feed reaches past this week's
 * start, and keeps the short form when the whole feed fits inside the week.
 *
 * Break this suite by: dropping the spansBeforeThisWeek option from the call.
 */
import { formatWeekMeta } from '../../hooks/history/historyUtils';
import type { WeeklyHistorySummary } from '../../hooks/history/historyUtils';

function summary(label: string): WeeklyHistorySummary {
    return {
        label,
        itemCount: 0,
        journalCount: 0,
        checkInCount: 0,
        activeDays: 0,
        activeDayKeys: [],
        weekDayKeys: [],
        topSignals: [],
        // Callers only read `label` here; the rest keeps the shape honest.
    } as unknown as WeeklyHistorySummary;
}

describe('formatWeekMeta', () => {
    it('keeps the short form when the feed fits inside this week', () => {
        expect(formatWeekMeta(summary('Nov 8 - Nov 14'))).toBe('This week · Nov 8–14');
    });

    it('says "and earlier" when the feed reaches past this week', () => {
        const line = formatWeekMeta(summary('Nov 8 - Nov 14'), { spansBeforeThisWeek: true });

        expect(line).toBe('This week and earlier · Nov 8–14');
    });

    it('crosses a month boundary without repeating the month twice', () => {
        const line = formatWeekMeta(summary('Oct 26 - Nov 1'), { spansBeforeThisWeek: true });

        expect(line).toBe('This week and earlier · Oct 26–Nov 1');
    });

    it('returns null rather than guessing when the label is malformed', () => {
        expect(formatWeekMeta(summary('nonsense'))).toBeNull();
    });
});
