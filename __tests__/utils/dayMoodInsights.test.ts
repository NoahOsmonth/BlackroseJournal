import type { DayMood } from '@/services/journal/dayMood';
import {
    buildDayMoodInsight,
    INSIGHT_WINDOW_DAYS,
    MIN_DAYS_FOR_LEAN,
    sideSummary,
} from '@/utils/dayMoodInsights';

const TODAY = '2026-11-09';

function day(moodId: string | null, factorIds: string[] = []): DayMood {
    return { moodId, factorIds, updatedAt: 1 };
}

/** Build a map of the last n days, newest first, from a list of entries. */
function mapOf(entries: DayMood[], startOffset = 0): Record<string, DayMood> {
    const out: Record<string, DayMood> = {};
    entries.forEach((entry, index) => {
        const date = new Date(2026, 10, 9);
        date.setDate(date.getDate() - (index + startOffset));
        const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
        out[key] = entry;
    });
    return out;
}

describe('day feeling insight', () => {
    it('says nothing at all when no day is recorded', () => {
        const insight = buildDayMoodInsight({}, TODAY);
        expect(insight.hasAnything).toBe(false);
        expect(insight.recordedDays).toBe(0);
        expect(insight.leanLine).toBeNull();
    });

    it('refuses a lean until both sides have enough days', () => {
        // Three lighter days naming People, but only one heavier day.
        const days = mapOf([
            day('light', ['people']),
            day('calm', ['people']),
            day('light', ['people']),
            day('heavy', ['work']),
        ]);
        const insight = buildDayMoodInsight(days, TODAY);
        expect(insight.lighter.days).toBe(3);
        expect(insight.heavier.days).toBe(1);
        expect(insight.leanLine).toBeNull();
        expect(MIN_DAYS_FOR_LEAN).toBe(4);
    });

    it('names a cause that leans clearly to the lighter side', () => {
        const days = mapOf([
            day('light', ['people']),
            day('calm', ['people']),
            day('light', ['people']),
            day('calm', []),
            day('heavy', ['work']),
            day('restless', ['work']),
            day('heavy', []),
            day('restless', []),
        ]);
        const insight = buildDayMoodInsight(days, TODAY);
        expect(insight.leanLine).toBe('On 3 of your 4 lighter days, People was in the mix.');
    });

    it('names a cause that leans clearly to the heavier side', () => {
        const days = mapOf([
            day('light', []),
            day('calm', []),
            day('light', []),
            day('calm', []),
            day('heavy', ['work']),
            day('restless', ['work']),
            day('heavy', ['work']),
            day('restless', []),
        ]);
        const insight = buildDayMoodInsight(days, TODAY);
        expect(insight.leanLine).toBe('On 3 of your 4 heavier days, Work was in the mix.');
    });

    it('stays quiet when a cause shows up on both sides equally', () => {
        const days = mapOf([
            day('light', ['people']),
            day('calm', ['people']),
            day('light', ['people']),
            day('calm', []),
            day('heavy', ['people']),
            day('restless', ['people']),
            day('heavy', ['people']),
            day('restless', []),
        ]);
        const insight = buildDayMoodInsight(days, TODAY);
        expect(insight.leanLine).toBeNull();
    });

    it('skips a day that has causes but no feeling instead of calling it neutral', () => {
        const days = mapOf([
            day(null, ['people']),
            day(null, ['work']),
            day('light', []),
        ]);
        const insight = buildDayMoodInsight(days, TODAY);
        expect(insight.recordedDays).toBe(3);
        expect(insight.lighter.days).toBe(1);
        expect(insight.heavier.days).toBe(0);
    });

    it('ignores days older than the window', () => {
        const days = mapOf([
            day('light', ['people']),
            day('light', ['people']),
            day('light', ['people']),
            day('light', ['people']),
        ], INSIGHT_WINDOW_DAYS + 2);
        const insight = buildDayMoodInsight(days, TODAY);
        expect(insight.recordedDays).toBe(0);
        expect(insight.hasAnything).toBe(false);
    });

    it('counts causes per side and sorts by count', () => {
        const days = mapOf([
            day('light', ['people', 'rest']),
            day('light', ['people']),
            day('heavy', ['work', 'sleep']),
            day('heavy', ['work']),
        ]);
        const insight = buildDayMoodInsight(days, TODAY);
        expect(insight.lighter.causes).toEqual([
            { id: 'people', label: 'People', count: 2 },
            { id: 'rest', label: 'Rest', count: 1 },
        ]);
        expect(insight.heavier.causes[0]).toEqual({ id: 'work', label: 'Work', count: 2 });
    });

    it('summarises a side in plain words, including the empty case', () => {
        expect(sideSummary({ days: 0, causes: [] })).toBe('No days yet');
        expect(sideSummary({ days: 1, causes: [] })).toBe('1 day, nothing named');
        expect(sideSummary({ days: 2, causes: [] })).toBe('2 days, nothing named');
        expect(sideSummary({
            days: 2,
            causes: [
                { id: 'people', label: 'People', count: 2 },
                { id: 'rest', label: 'Rest', count: 1 },
            ],
        })).toBe('2 days: People, Rest');
    });
});
