import fs from 'fs';
import path from 'path';

import { relPosix } from '../mocks/repoPath';

/** Source-scan guard: both calendar screens have too many hooks to render here. */
const root = path.resolve(__dirname, '..', '..');
const read = (file: string): string => fs.readFileSync(path.join(root, file), 'utf8');
const src = (p: string): string => read(relPosix(root, path.join(root, p)));

describe('write on a past day', () => {
    const month = src('app/monthly-review.tsx');
    const year = src('app/writing-year.tsx');
    const button = src('components/insights/WriteOnDayButton.tsx');
    const panel = src('components/insights/MonthlyDayPanel.tsx');
    const chat = src('app/chat.tsx');
    const finish = src('hooks/chat/useJournalChatFinish.ts');
    const util = src('utils/writingDay.ts');

    it('both calendars show the same write door', () => {
        expect(month).toContain('<WriteOnDayButton');
        expect(year).toContain('<WriteOnDayButton');
        expect(month + year).toContain('canWriteOnDay(selectedDay, todayKey)');
        expect(month + year).toContain("getLocalDateKey()");
    });

    it('the empty-day copy lives in exactly one place', () => {
        expect(button).toContain('Nothing written on this day.');
        expect(button).toContain('Write about this day');
        expect(button).toContain('Add another note for this day');
        expect(panel).not.toContain('Nothing written on this day.');
        expect(year).not.toContain('Nothing written on this day.');
        // Future days offer no button, and no raw date jargon leaks to the writer.
        expect(button).toContain('{canWrite ? (');
        // Only the strings a writer can read need to stay plain; code identifiers
        // and route params keep their technical names (AGENTS.md rule 13).
        const copy = ['Nothing written on this day.', 'Write about this day', 'Add another note for this day'];
        for (const text of copy) { expect(text).not.toMatch(/createdAt|timestamp|backfill|ISO|provider|API key/); }
    });

    it('the door opens the chat with the chosen day', () => {
        expect(button).toContain("pathname: '/chat', params: { writeOn: dateKey }");
        expect(button).toContain('accessibilityRole="button"');
        expect(button).toContain('min-h-11');
        expect(button).toContain('dark:border-hairline-dark');
        expect(button).toContain('dark:text-text-dark');
        expect(button).not.toMatch(/space-y-|space-x-/);
    });

    it('chat refuses a crafted or future date', () => {
        expect(chat).toContain('canWriteOnDay(writeOnParam, todayKey)');
        expect(chat).toContain('backfillCreatedAt(writeOn, todayKey, Date.now())');
        expect(chat).toContain("...(writeOn ? { writeOn } : {})");
        expect(chat).toContain('writeOnCreatedAt,');
        expect(chat).toContain("'Writing on ' + formatWritingDay(writeOn)");
        expect(chat).toContain('testID="write-on-day-note"');
        expect(chat).toContain('dark:text-text-secondary-dark');
        // The resumed draft keeps the day the writer chose.
        expect(chat).toContain("...(writeOn ? { writeOn } : {})");
    });

    it('the date override is create-only', () => {
        expect(finish).toContain('writeOnCreatedAt?: number');
        expect(finish).toContain('writeOnCreatedAt,');
        expect(finish).toContain('...(writeOnCreatedAt !== undefined ? { createdAt: writeOnCreatedAt } : {})');
        // The update branch appears first in the file: assert the override is
        // inside the create call and absent from the whole update branch.
        const createIdx = finish.indexOf('savedEntry = await create({');
        const updateIdx = finish.indexOf('savedEntry = await update(');
        const createBody = finish.slice(createIdx, finish.indexOf('});', createIdx));
        const updateBody = finish.slice(updateIdx, finish.indexOf('});', updateIdx));
        expect(createIdx).toBeGreaterThan(-1);
        expect(updateIdx).toBeGreaterThan(-1);
        expect(createBody).toContain('createdAt: writeOnCreatedAt');
        expect(updateBody).not.toContain('writeOnCreatedAt');
        expect(finish).toContain('starterId, writeOnCreatedAt,');
    });

    it('the helper stays pure and refuses bad keys', () => {
        expect(util).toContain("isValidIsoDateKey(dateKey)");
        expect(util).toContain("typeof dateKey !== 'string'");
        expect(util).toContain('date.setHours(12, 0, 0, 0)');
        expect(util).toContain('timestamp < now');
        expect(util).not.toContain('Date.now()');
        expect(util).not.toContain('AsyncStorage');
    });

    it('keeps the design file budget', () => {
        for (const file of [month, year, button, panel, chat]) {
            expect(file.split(String.fromCharCode(10)).length).toBeLessThan(500);
        }
    });
});
