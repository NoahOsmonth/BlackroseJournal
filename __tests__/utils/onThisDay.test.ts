import { getLocalDateKeyFromTimestamp } from '@/utils/date';
import { pickOnThisDay, OnThisDayEntry } from '@/utils/onThisDay';

const NOW = new Date(2026, 10, 8, 9, 30).getTime();
const ON_DAY_THIS_YEAR = getLocalDateKeyFromTimestamp(NOW);
const onThisDayLastYear = getLocalDateKeyFromTimestamp(new Date(2024, 10, 8, 20, 5).getTime());
const otherDay = getLocalDateKeyFromTimestamp(new Date(2024, 10, 9, 20, 5).getTime());
const olderYear = getLocalDateKeyFromTimestamp(new Date(2021, 10, 8, 7, 0).getTime());

function entry(overrides: Partial<OnThisDayEntry>): OnThisDayEntry {
    return {
        id: 'journal-1',
        dateKey: onThisDayLastYear,
        createdAt: new Date(2024, 10, 8, 20, 5).getTime(),
        title: 'A quiet morning',
        summary: 'The kettle was the loudest thing in the flat.',
        ...overrides,
    };
}

describe('pickOnThisDay', () => {
    it('finds an entry written on the same date in an earlier year', () => {
        const picked = pickOnThisDay([entry({})], NOW);
        expect(picked).not.toBeNull();
        expect(picked?.yearsAgo).toBe(2);
        expect(picked?.label).toBe('Two years ago today');
        expect(picked?.entry.title).toBe('A quiet morning');
    });

    it('labels the previous year in plain words', () => {
        const lastYear = new Date(2025, 10, 8, 8, 0).getTime();
        const picked = pickOnThisDay([entry({ createdAt: lastYear, dateKey: getLocalDateKeyFromTimestamp(lastYear) })], NOW);
        expect(picked?.label).toBe('A year ago today');
    });

    it('ignores entries from today, other days, and later years', () => {
        const today = entry({ id: 'journal-today', createdAt: NOW, dateKey: ON_DAY_THIS_YEAR });
        const laterYear = new Date(2030, 10, 8, 8, 0).getTime();
        const future = entry({ id: 'journal-future', createdAt: laterYear, dateKey: getLocalDateKeyFromTimestamp(laterYear) });
        expect(pickOnThisDay([entry({ dateKey: otherDay }), today, future], NOW)).toBeNull();
    });

    it('prefers the oldest matching year and falls back to the next one', () => {
        const recent = entry({ id: 'journal-2025', createdAt: new Date(2025, 10, 8, 8, 0).getTime(), dateKey: getLocalDateKeyFromTimestamp(new Date(2025, 10, 8, 8, 0).getTime()) });
        const old = entry({ id: 'journal-2021', dateKey: olderYear, createdAt: new Date(2021, 10, 8, 7, 0).getTime() });
        expect(pickOnThisDay([recent, old], NOW)?.entry.id).toBe('journal-2021');
        expect(pickOnThisDay([recent], NOW)?.entry.id).toBe('journal-2025');
    });

    it('returns null for an empty feed', () => {
        expect(pickOnThisDay([], NOW)).toBeNull();
    });
});
