import { buildWritingDayRows, countWritingWords } from '../../utils/writingDayRows';
import type { JournalEntry } from '../../services/journal/journalStorage.types';
import type { IntentionCheckIn } from '../../services/intentions/intentionsStorage.types';

const DAY = new Date(2026, 10, 9, 12).getTime();
const LATER = new Date(2026, 10, 9, 18).getTime();
const OTHER = new Date(2026, 10, 3, 12).getTime();

function entry(id: string, createdAt: number, title: string, body: string): JournalEntry {
    return {
        id,
        title,
        emoji: '📝',
        messages: [{ id: 'm-' + id, role: 'user' as const, content: body, timestamp: createdAt }],
        status: 'completed',
        createdAt,
        updatedAt: createdAt,
    };
}

function checkIn(id: string, createdAt: number, title: string, summary: string): IntentionCheckIn {
    return {
        id,
        type: 'morning',
        title,
        summary,
        status: 'completed',
        createdAt,
        updatedAt: createdAt,
    };
}

describe('buildWritingDayRows', () => {
    it('counts words in a body and returns zero for blank text', () => {
        expect(countWritingWords('  a quiet   walk  ')).toBe(3);
        expect(countWritingWords('   ')).toBe(0);
    });

    it('groups entries and check-ins by local day', () => {
        const rows = buildWritingDayRows(
            [entry('e1', DAY, 'A walk', 'one two')],
            [checkIn('c1', DAY, 'Morning', 'a small win')],
        );
        expect(rows.size).toBe(1);
        const day = rows.get('2026-11-09');
        expect(day?.items).toHaveLength(2);
        // 'Morning a small win' (4) + 'one two' (2); check-in text is title+summary.
        expect(day?.totalWords).toBe(6);
    });

    it('sorts a day newest-first', () => {
        const rows = buildWritingDayRows(
            [entry('old', DAY, 'Old', 'one'), entry('new', LATER, 'New', 'two')],
            [],
        );
        expect(rows.get('2026-11-09')?.items.map((i) => i.id)).toEqual(['new', 'old']);
    });

    it('keeps separate days separate', () => {
        const rows = buildWritingDayRows(
            [entry('e1', DAY, 'A', 'one'), entry('e2', OTHER, 'B', 'two three')],
            [],
        );
        expect(rows.size).toBe(2);
        expect(rows.get('2026-11-03')?.totalWords).toBe(2);
    });

    it('uses both title fallbacks without dropping the real id', () => {
        const rows = buildWritingDayRows(
            [entry('e1', DAY, '', 'hello world')],
            [checkIn('c1', DAY, '', 'a check in')],
        );
        const items = rows.get('2026-11-09')?.items ?? [];
        expect(items.map((i) => i.title).sort()).toEqual(['A check-in', 'A journal moment']);
        expect(items.every((i) => i.id === 'e1' || i.id === 'c1')).toBe(true);
    });

    it('keeps kind so the two detail routes stay distinct', () => {
        const rows = buildWritingDayRows(
            [entry('e1', DAY, 'A', 'one')],
            [checkIn('c1', OTHER, 'B', 'two')],
        );
        expect(rows.get('2026-11-09')?.items[0].kind).toBe('entry');
        expect(rows.get('2026-11-03')?.items[0].kind).toBe('checkin');
    });

    it('clamps the preview to 140 characters', () => {
        const long = 'x'.repeat(300);
        const rows = buildWritingDayRows([entry('e1', DAY, 'A', long)], []);
        expect(rows.get('2026-11-09')?.items[0].preview).toHaveLength(140);
        expect(rows.get('2026-11-09')?.items[0].words).toBe(1);
    });

    it('uses the authored body for entry previews, title+summary for check-ins', () => {
        const rows = buildWritingDayRows(
            [entry('e1', DAY, 'Title', 'the walk was quiet')],
            [checkIn('c1', OTHER, 'Morning', 'felt steady')],
        );
        expect(rows.get('2026-11-09')?.items[0].preview).toBe('the walk was quiet');
        expect(rows.get('2026-11-03')?.items[0].preview).toBe('felt steady');
    });

    it('is deterministic and never mutates its inputs', () => {
        const entries = [entry('e1', DAY, 'A', 'one two')];
        const checkIns = [checkIn('c1', DAY, 'B', 'three')];
        const a = buildWritingDayRows(entries, checkIns);
        const b = buildWritingDayRows(entries, checkIns);
        expect([...a.keys()]).toEqual([...b.keys()]);
        expect(entries[0].title).toBe('A');
        expect(checkIns[0].summary).toBe('three');
    });

    it('handles empty collections', () => {
        expect(buildWritingDayRows([], []).size).toBe(0);
    });
});
