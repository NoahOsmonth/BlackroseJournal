import {
    GUIDED_PROMPTS,
    moodForHour,
    promptsByMood,
    promptsForDay,
} from '@/utils/guidedPrompts';

describe('moodForHour', () => {
    it('reads morning, afternoon and evening', () => {
        expect(moodForHour(7)).toBe('morning');
        expect(moodForHour(14)).toBe('anytime');
        expect(moodForHour(21)).toBe('evening');
    });

    it('treats late night as evening', () => {
        expect(moodForHour(2)).toBe('evening');
    });

    it('switches at the boundaries', () => {
        expect(moodForHour(4)).toBe('evening');
        expect(moodForHour(5)).toBe('morning');
        expect(moodForHour(11)).toBe('morning');
        expect(moodForHour(12)).toBe('anytime');
        expect(moodForHour(17)).toBe('evening');
    });
});

describe('promptsForDay', () => {
    it('offers the requested number', () => {
        expect(promptsForDay('2026-11-08', 'evening', 4)).toHaveLength(4);
    });

    it('never offers a prompt that does not fit the hour ahead of one that does', () => {
        const out = promptsForDay('2026-11-08', 'morning', 6);
        const moods = out.map((p) => p.mood);
        const firstWrong = moods.findIndex((m) => m !== 'morning' && m !== 'anytime');
        if (firstWrong !== -1) {
            expect(moods.slice(firstWrong).every((m) => m !== 'morning')).toBe(true);
        }
    });

    it('is stable within a day', () => {
        const a = promptsForDay('2026-11-08', 'evening', 4).map((p) => p.id);
        const b = promptsForDay('2026-11-08', 'evening', 4).map((p) => p.id);
        expect(a).toEqual(b);
    });

    it('changes the shelf on a different day', () => {
        const days = ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'];
        const shelves = days.map((d) => promptsForDay(d, 'anytime', 3).map((p) => p.id).join(','));
        expect(new Set(shelves).size).toBeGreaterThan(1);
    });

    it('returns nothing for a zero or negative count', () => {
        expect(promptsForDay('2026-11-08', 'anytime', 0)).toEqual([]);
        expect(promptsForDay('2026-11-08', 'anytime', -2)).toEqual([]);
    });

    it('never repeats a prompt within one shelf', () => {
        const ids = promptsForDay('2026-11-08', 'anytime', 6).map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('the prompt shelf itself', () => {
    it('has unique ids', () => {
        const ids = GUIDED_PROMPTS.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('every opening is a sentence a person would actually type', () => {
        for (const prompt of GUIDED_PROMPTS) {
            expect(prompt.opening.trim().length).toBeGreaterThan(8);
            // No trailing full stop: the writer continues the line.
            expect(prompt.opening.trim().endsWith('.')).toBe(false);
        }
    });

    it('groups by mood without dropping the anytime ones', () => {
        const evening = promptsByMood('evening');
        expect(evening.some((p) => p.mood === 'evening')).toBe(true);
        expect(evening.some((p) => p.mood === 'anytime')).toBe(true);
        expect(evening.every((p) => p.mood !== 'morning')).toBe(true);
    });
});
