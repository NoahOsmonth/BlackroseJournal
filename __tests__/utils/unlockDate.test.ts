import {
    describeDayKey,
    isValidDayKey,
    monthGrid,
    monthLabel,
    quickChoices,
    upcomingMonths,
} from '@/utils/unlockDate';

describe('quickChoices', () => {
    it('offers a week, a month and a year', () => {
        const ids = quickChoices('2026-11-08').map((c) => c.id);
        expect(ids).toEqual(['week', 'month', 'year']);
    });

    it('counts a week from today', () => {
        const week = quickChoices('2026-11-08').find((c) => c.id === 'week');
        expect(week?.dayKey).toBe('2026-11-15');
    });

    it('counts a month across a month boundary', () => {
        const month = quickChoices('2026-11-08').find((c) => c.id === 'month');
        expect(month?.dayKey).toBe('2026-12-08');
    });

    it('counts a year into the next year', () => {
        const year = quickChoices('2026-11-08').find((c) => c.id === 'year');
        expect(year?.dayKey).toBe('2027-11-08');
    });

    it('does not overflow a short month', () => {
        // 31 Jan + 1 month must land on 28 Feb, not 3 March
        expect(quickChoices('2026-01-31').find((c) => c.id === 'month')?.dayKey).toBe('2026-02-28');
    });

    it('does not overflow onto 29 Feb in a common year', () => {
        expect(quickChoices('2026-02-28').find((c) => c.id === 'month')?.dayKey).toBe('2026-03-28');
    });

    it('returns nothing for an impossible day', () => {
        expect(quickChoices('2026-02-31')).toEqual([]);
    });
});

describe('monthGrid', () => {
    it('starts Monday and pads the first week', () => {
        // 1 Nov 2026 is a Sunday, so it sits in the last column
        const cells = monthGrid(2026, 10, '2026-11-08');
        const leading = cells.filter((c) => c.dayKey === '').length;
        expect(leading).toBe(6);
        expect(cells[6].dayKey).toBe('2026-11-01');
    });

    it('has one cell per day of the month', () => {
        const cells = monthGrid(2026, 10, '2026-11-08').filter((c) => c.dayKey !== '');
        expect(cells).toHaveLength(30);
    });

    it('knows February in a leap year', () => {
        const cells = monthGrid(2028, 1, '2028-02-01').filter((c) => c.dayKey !== '');
        expect(cells).toHaveLength(29);
    });

    it('marks days before today as past', () => {
        const cells = monthGrid(2026, 10, '2026-11-08');
        expect(cells.find((c) => c.dayKey === '2026-11-07')?.isPast).toBe(true);
        expect(cells.find((c) => c.dayKey === '2026-11-08')?.isPast).toBe(false);
        expect(cells.find((c) => c.dayKey === '2026-11-09')?.isPast).toBe(false);
    });
});

describe('monthLabel', () => {
    it('names the month and year plainly', () => {
        expect(monthLabel(2026, 10)).toBe('November 2026');
    });
});

describe('upcomingMonths', () => {
    it('starts with the current month', () => {
        expect(upcomingMonths('2026-11-08')[0]).toEqual({ year: 2026, monthIndex: 10 });
    });

    it('gives twelve months by default', () => {
        expect(upcomingMonths('2026-11-08')).toHaveLength(12);
    });

    it('rolls into the next year', () => {
        const months = upcomingMonths('2026-11-08');
        expect(months[2]).toEqual({ year: 2027, monthIndex: 0 });
    });
});

describe('describeDayKey', () => {
    it('says the day in plain words with its weekday', () => {
        expect(describeDayKey('2026-11-08')).toBe('Sunday 8 November 2026');
    });

    it('falls back to the raw key when it cannot read it', () => {
        expect(describeDayKey('nonsense')).toBe('nonsense');
    });
});

describe('isValidDayKey', () => {
    it('accepts a real day', () => {
        expect(isValidDayKey('2026-11-08')).toBe(true);
    });

    it('refuses an impossible day', () => {
        expect(isValidDayKey('2026-02-31')).toBe(false);
    });

    it('refuses a malformed key', () => {
        expect(isValidDayKey('8/11/2026')).toBe(false);
    });
});
