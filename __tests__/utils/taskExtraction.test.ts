import {
    cleanTaskTitle,
    dedupeTasks,
    parseTaskSuggestions,
    TASK_PROPOSAL_LIMIT,
} from '@/utils/taskExtraction';

describe('cleanTaskTitle', () => {
    it('trims and collapses whitespace', () => {
        expect(cleanTaskTitle('  call   the   dentist  ')).toBe('call the dentist');
    });

    it('drops a leading bullet or checkbox the model added', () => {
        expect(cleanTaskTitle('- [ ] call the dentist')).toBe('call the dentist');
        expect(cleanTaskTitle('* call the dentist')).toBe('call the dentist');
    });

    it('drops a trailing full stop so titles read as tasks', () => {
        expect(cleanTaskTitle('Call the dentist.')).toBe('Call the dentist');
    });

    it('keeps a question mark, which is meaning', () => {
        expect(cleanTaskTitle('Should I move house?')).toBe('Should I move house?');
    });

    it('rejects empty and over-long titles', () => {
        expect(cleanTaskTitle('   ')).toBeNull();
        expect(cleanTaskTitle('x'.repeat(200))).toBeNull();
    });
});

describe('parseTaskSuggestions', () => {
    it('reads a plain array of strings', () => {
        expect(parseTaskSuggestions(['call the dentist', 'book a haircut']))
            .toEqual(['call the dentist', 'book a haircut']);
    });

    it('reads an object with a tasks key, as models often return', () => {
        expect(parseTaskSuggestions({ tasks: [{ title: 'call the dentist' }] }))
            .toEqual(['call the dentist']);
    });

    it('keeps at most the proposal limit', () => {
        const many = Array.from({ length: 12 }, (_, index) => `task number ${index}`);
        expect(parseTaskSuggestions(many)).toHaveLength(TASK_PROPOSAL_LIMIT);
    });

    it('returns nothing for garbage rather than throwing', () => {
        expect(parseTaskSuggestions(null)).toEqual([]);
        expect(parseTaskSuggestions('not a list')).toEqual([]);
        expect(parseTaskSuggestions([42, {}, ''])).toEqual([]);
    });
});

describe('dedupeTasks', () => {
    it('drops a suggestion that repeats one already on the list', () => {
        const result = dedupeTasks(
            ['Call the dentist', 'Book a haircut'],
            ['call the dentist!', 'Book a haircut', 'Buy milk'],
        );
        expect(result).toEqual(['Buy milk']);
    });

    it('drops repeats inside the suggestions themselves', () => {
        expect(dedupeTasks([], ['Buy milk', 'buy milk'])).toEqual(['Buy milk']);
    });

    it('keeps a genuinely different task that shares a word', () => {
        expect(dedupeTasks(['Call the dentist'], ['Call the plumber']))
            .toEqual(['Call the plumber']);
    });
});
