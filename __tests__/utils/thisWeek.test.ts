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
    it('ends on today and covers seven days', () => {
        const keys = weekWindowKeys('2026-11-08');
        expect(keys).toHaveLength(7);
        expect(keys[6]).toBe('2026-11-08');
        expect(keys[0]).toBe('2026-11-02');
    });

    it('crosses a month boundary', () => {
        expect(weekWindowKeys('2026-03-02')[0]).toBe('2026-02-24');
    });

    it('gives up quietly on a malformed key', () => {
        expect(weekWindowKeys('not-a-date')).toEqual([]);
    });
});
