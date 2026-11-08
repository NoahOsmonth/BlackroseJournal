import {
    DEFAULT_REMINDER_SETTINGS,
    describeReminderSchedule,
    formatTime,
    planReminders,
    type ReminderSettings,
} from '@/utils/reminders';

const ON: ReminderSettings = {
    ...DEFAULT_REMINDER_SETTINGS,
    morningEnabled: true,
    eveningEnabled: true,
};

/** Local date at a given hour/minute, so tests do not depend on the wall clock. */
function at(hour: number, minute = 0): Date {
    const d = new Date(2026, 10, 8, hour, minute, 0, 0);
    return d;
}

describe('formatTime', () => {
    it('reads as a clock', () => {
        expect(formatTime({ hour: 8, minute: 0 })).toBe('8:00 AM');
        expect(formatTime({ hour: 21, minute: 30 })).toBe('9:30 PM');
    });

    it('handles midnight and noon', () => {
        expect(formatTime({ hour: 0, minute: 0 })).toBe('12:00 AM');
        expect(formatTime({ hour: 12, minute: 15 })).toBe('12:15 PM');
    });
});

describe('planReminders', () => {
    it('plans nothing when both are off', () => {
        const plans = planReminders({
            settings: DEFAULT_REMINDER_SETTINGS,
            now: at(7),
            wroteMorning: false,
            wroteEvening: false,
        });
        expect(plans).toEqual([]);
    });

    it('plans both when both are on and nothing is written', () => {
        const plans = planReminders({ settings: ON, now: at(7), wroteMorning: false, wroteEvening: false });
        expect(plans.map((p) => p.slot)).toEqual(['morning', 'evening']);
    });

    it('drops a reminder whose time has already passed', () => {
        const plans = planReminders({ settings: ON, now: at(9), wroteMorning: false, wroteEvening: false });
        expect(plans.map((p) => p.slot)).toEqual(['evening']);
    });

    it('does not fire at the exact minute the reminder is set for', () => {
        const plans = planReminders({ settings: ON, now: at(8, 0), wroteMorning: false, wroteEvening: false });
        expect(plans.map((p) => p.slot)).toEqual(['evening']);
    });

    it('skips the morning when the writer already wrote', () => {
        const plans = planReminders({ settings: ON, now: at(7), wroteMorning: true, wroteEvening: false });
        expect(plans.map((p) => p.slot)).toEqual(['evening']);
    });

    it('still nudges a writer who keeps the skip rule off', () => {
        const settings: ReminderSettings = { ...ON, skipWhenAlreadyWritten: false };
        const plans = planReminders({ settings, now: at(7), wroteMorning: true, wroteEvening: true });
        expect(plans.map((p) => p.slot)).toEqual(['morning', 'evening']);
    });

    it('points each plan at the right local time today', () => {
        const plans = planReminders({ settings: ON, now: at(7), wroteMorning: false, wroteEvening: false });
        const evening = plans.find((p) => p.slot === 'evening');
        expect(evening?.fireAt.getHours()).toBe(21);
        expect(evening?.fireAt.getMinutes()).toBe(0);
        expect(evening?.fireAt.getDate()).toBe(8);
    });

    it('writes copy in plain words with no jargon', () => {
        const plans = planReminders({ settings: ON, now: at(7), wroteMorning: false, wroteEvening: false });
        for (const plan of plans) {
            expect(plan.title.length).toBeGreaterThan(0);
            expect(plan.body).toMatch(/[?.]$/);
        }
    });
});

describe('describeReminderSchedule', () => {
    it('says Off when nothing is on', () => {
        expect(describeReminderSchedule(DEFAULT_REMINDER_SETTINGS)).toBe('Off');
    });

    it('names each time that will fire', () => {
        expect(describeReminderSchedule(ON)).toBe('Morning at 8:00 AM · evening at 9:00 PM');
    });

    it('describes only the evening when that is all that is on', () => {
        const settings: ReminderSettings = { ...ON, morningEnabled: false };
        expect(describeReminderSchedule(settings)).toBe('evening at 9:00 PM');
    });
});
