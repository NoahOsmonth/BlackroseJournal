import {
    daysUntilUnlock,
    describeUnlock,
    isLetterUnlocked,
    letterDraftIssue,
    toListEntries,
    type LetterRecord,
} from '@/utils/letters';

const TODAY = '2026-11-08';

function letter(overrides: Partial<LetterRecord> = {}): LetterRecord {
    return {
        id: 'l1',
        body: 'Dear future me, the kitchen leak finally got fixed.',
        unlockDate: '2026-12-25',
        writtenDate: '2026-11-08',
        createdAt: 1,
        ...overrides,
    };
}

describe('isLetterUnlocked', () => {
    it('stays sealed before the day', () => {
        expect(isLetterUnlocked('2026-12-25', TODAY)).toBe(false);
    });

    it('opens on the day itself, not after it', () => {
        expect(isLetterUnlocked('2026-11-08', TODAY)).toBe(true);
    });

    it('stays open once the day has passed', () => {
        expect(isLetterUnlocked('2026-01-01', TODAY)).toBe(true);
    });
});

describe('daysUntilUnlock', () => {
    it('counts days ahead', () => {
        expect(daysUntilUnlock('2026-11-11', TODAY)).toBe(3);
    });

    it('never goes negative', () => {
        expect(daysUntilUnlock('2026-01-01', TODAY)).toBe(0);
    });

    it('crosses a month end', () => {
        expect(daysUntilUnlock('2026-12-01', '2026-11-28')).toBe(3);
    });
});

describe('describeUnlock', () => {
    it('says Today and Tomorrow in plain words', () => {
        expect(describeUnlock('2026-11-08', TODAY)).toBe('Today');
        expect(describeUnlock('2026-11-09', TODAY)).toBe('Tomorrow');
    });

    it('counts short waits in days', () => {
        expect(describeUnlock('2026-11-11', TODAY)).toBe('in 3 days');
    });

    it('switches to weeks and months for long waits', () => {
        expect(describeUnlock('2026-11-22', TODAY)).toBe('in 2 weeks');
        expect(describeUnlock('2027-02-06', TODAY)).toMatch(/in \d+ months/);
    });

    it('never shows a raw date', () => {
        expect(describeUnlock('2027-06-01', TODAY)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    });
});

describe('toListEntries', () => {
    it('hides the words of a sealed letter', () => {
        const [entry] = toListEntries([letter()], TODAY);
        expect(entry.body).toBeUndefined();
        expect(entry.isUnlocked).toBe(false);
        expect(JSON.stringify(entry)).not.toContain('kitchen leak');
    });

    it('shows the words once unlocked', () => {
        const [entry] = toListEntries([letter({ unlockDate: '2026-11-01' })], TODAY);
        expect(entry.body).toContain('kitchen leak');
        expect(entry.unlockLabel).toBe('Opened');
    });

    it('lists the soonest to open first', () => {
        const out = toListEntries([
            letter({ id: 'far', unlockDate: '2027-05-01' }),
            letter({ id: 'near', unlockDate: '2026-11-09' }),
        ], TODAY);
        expect(out.map((e) => e.id)).toEqual(['near', 'far']);
    });
});

describe('letterDraftIssue', () => {
    it('asks for words first', () => {
        expect(letterDraftIssue('   ', '2026-12-25', TODAY)?.message).toMatch(/Write something/);
    });

    it('asks for a day', () => {
        expect(letterDraftIssue('hi', '', TODAY)?.message).toMatch(/Pick the day/);
    });

    it('refuses to seal a letter for today', () => {
        expect(letterDraftIssue('hi', TODAY, TODAY)?.message).toMatch(/day in the future/);
    });

    it('accepts a real future day', () => {
        expect(letterDraftIssue('hello future me', '2026-12-25', TODAY)).toBeNull();
    });
});
