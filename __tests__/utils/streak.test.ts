import { calculateCurrentStreak } from '@/utils/streak';

function entry(id: string, dateIso: string) {
    return {
        id,
        title: 't',
        emoji: '📝',
        messages: [{ id: 'm', role: 'user' as const, content: 'x', timestamp: 1 }],
        status: 'completed' as const,
        createdAt: new Date(dateIso).getTime(),
        updatedAt: new Date(dateIso).getTime(),
    };
}

describe('calculateCurrentStreak', () => {
    it('returns 0 when no entries', () => {
        const streak = calculateCurrentStreak([], new Date('2026-01-19T12:00:00Z'));
        expect(streak).toBe(0);
    });

    it('counts consecutive days ending today', () => {
        const entries = [
            entry('e1', '2026-01-19T08:00:00Z'),
            entry('e2', '2026-01-18T10:00:00Z'),
            entry('e3', '2026-01-17T23:00:00Z'),
        ];

        const streak = calculateCurrentStreak(entries as any, new Date('2026-01-19T12:00:00Z'));
        expect(streak).toBe(3);
    });

    it('treats multiple entries on same day as one day', () => {
        const entries = [
            entry('e1', '2026-01-19T08:00:00Z'),
            entry('e2', '2026-01-19T18:00:00Z'),
            entry('e3', '2026-01-18T10:00:00Z'),
        ];

        const streak = calculateCurrentStreak(entries as any, new Date('2026-01-19T12:00:00Z'));
        expect(streak).toBe(2);
    });

    it('breaks streak when a day is missing', () => {
        const entries = [
            entry('e1', '2026-01-19T08:00:00Z'),
            entry('e2', '2026-01-17T10:00:00Z'),
        ];

        const streak = calculateCurrentStreak(entries as any, new Date('2026-01-19T12:00:00Z'));
        expect(streak).toBe(1);
    });
});
