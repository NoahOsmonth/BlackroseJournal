import { collectWeeklyThemes, weekWindowKeys } from '@/utils/thisWeek';

describe('collectWeeklyThemes', () => {
    it('finds a word that came back on different days', () => {
        const ledger = collectWeeklyThemes([
            { dateKey: '2026-11-02', text: 'Slept badly again, brain would not settle.' },
            { dateKey: '2026-11-04', text: 'Better day once I let myself sleep in.' },
            { dateKey: '2026-11-05', text: 'Walked by the river.' },
        ]);
        expect(ledger.themes.map((t) => t.label)).toContain('sleep');
        expect(ledger.daysWritten).toBe(3);
    });

    it('does not call one long entry a recurring theme', () => {
        const ledger = collectWeeklyThemes([
            { dateKey: '2026-11-02', text: 'sleep sleep sleep sleep sleep' },
        ]);
        expect(ledger.themes).toHaveLength(0);
    });

    it('counts walks and walk as one theme', () => {
        const ledger = collectWeeklyThemes([
            { dateKey: '2026-11-02', text: 'Long walks after dinner helped.' },
            { dateKey: '2026-11-03', text: 'Another walk, this time in the rain.' },
        ]);
        const walk = ledger.themes.find((t) => t.label === 'walk');
        expect(walk).toBeDefined();
        expect(walk?.days).toBe(2);
        expect(walk?.mentions).toBe(2);
    });

    it('ignores everyday filler words', () => {
        const ledger = collectWeeklyThemes([
            { dateKey: '2026-11-02', text: 'Really just feeling that thing again today.' },
            { dateKey: '2026-11-03', text: 'Really just that thing again today.' },
        ]);
        expect(ledger.themes).toHaveLength(0);
    });

    it('keeps the list short and steadiest first', () => {
        const ledger = collectWeeklyThemes([
            { dateKey: '2026-11-02', text: 'work worry sleep walk' },
            { dateKey: '2026-11-03', text: 'work worry sleep' },
            { dateKey: '2026-11-04', text: 'work worry' },
            { dateKey: '2026-11-05', text: 'work' },
        ]);
        expect(ledger.themes.length).toBeLessThanOrEqual(5);
        expect(ledger.themes[0].label).toBe('work');
        expect(ledger.themes[0].days).toBe(4);
    });

    it('returns nothing for an empty week', () => {
        expect(collectWeeklyThemes([])).toEqual({ daysWritten: 0, totalDays: 7, themes: [] });
    });

    it('does not treat numbers as themes', () => {
        const ledger = collectWeeklyThemes([
            { dateKey: '2026-11-02', text: 'ran 1234 1234 steps' },
            { dateKey: '2026-11-03', text: 'ran 1234 1234 again' },
        ]);
        expect(ledger.themes.map((t) => t.label)).not.toContain('1234');
    });
});

describe('weekWindowKeys', () => {
    // The window is the CALENDAR week (Sunday to Saturday) containing the key,
    // the same span Insights uses for the weekly letter, the writing stats and
    // the unlock threshold. It used to be a rolling seven days ending today,
    // so on Sunday 8 Nov Goals said "this week" about 2-8 Nov while Insights
    // said it about 8-14 Nov.
    it('covers the calendar week containing the key, Sunday first', () => {
        const keys = weekWindowKeys('2026-11-08');
        expect(keys).toHaveLength(7);
        expect(keys[0]).toBe('2026-11-08');
        expect(keys[6]).toBe('2026-11-14');
    });

    it('anchors on the week, not on the given day', () => {
        // Wednesday 11 Nov belongs to the same Sun-Sat week as Sunday 8 Nov.
        expect(weekWindowKeys('2026-11-11')).toEqual(weekWindowKeys('2026-11-08'));
    });

    it('crosses a month boundary', () => {
        // Mon 2 Mar 2026 sits in the week starting Sun 1 Mar; the week before
        // it starts Sun 22 Feb.
        expect(weekWindowKeys('2026-02-25')[0]).toBe('2026-02-22');
        expect(weekWindowKeys('2026-02-25')[6]).toBe('2026-02-28');
    });

    it('gives up quietly on a malformed key', () => {
        expect(weekWindowKeys('not-a-date')).toEqual([]);
    });
});
