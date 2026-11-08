/**
 * Reminder timing (Kaneo #9).
 *
 * The decision layer for morning and evening nudges. It answers three
 * questions, all without touching a scheduler or a clock of its own:
 *
 *   1. Should a reminder fire at all today?
 *   2. At what local time?
 *   3. What should it say?
 *
 * Everything here is pure, so the awkward cases — a dusk reminder after the
 * writer has already written, a reminder set for a time that is already past,
 * a disabled toe — are all testable without a device.
 */

export type ReminderSlot = 'morning' | 'evening';

export interface ReminderTime {
    /** 0–23 local hour. */
    readonly hour: number;
    /** 0–59 local minute. */
    readonly minute: number;
}

export interface ReminderSettings {
    readonly morningEnabled: boolean;
    readonly morning: ReminderTime;
    readonly eveningEnabled: boolean;
    readonly evening: ReminderTime;
    /** Suppress the reminder if the writer already wrote that slot today. */
    readonly skipWhenAlreadyWritten: boolean;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
    morningEnabled: false,
    morning: { hour: 8, minute: 0 },
    eveningEnabled: false,
    evening: { hour: 21, minute: 0 },
    skipWhenAlreadyWritten: true,
};

/** "8:00 AM" / "9:30 PM" — the form Settings shows. */
export function formatTime(time: ReminderTime): string {
    const suffix = time.hour < 12 ? 'AM' : 'PM';
    const hour12 = time.hour % 12 === 0 ? 12 : time.hour % 12;
    const minutes = String(time.minute).padStart(2, '0');
    return `${hour12}:${minutes} ${suffix}`;
}

/** Minutes from local midnight, so comparisons are one number. */
export function toMinutes(time: ReminderTime): number {
    return time.hour * 60 + time.minute;
}

export interface ReminderPlan {
    readonly slot: ReminderSlot;
    readonly at: ReminderTime;
    readonly title: string;
    readonly body: string;
    /** Absolute local timestamp for the next firing. */
    readonly fireAt: Date;
}

interface PlanInput {
    readonly settings: ReminderSettings;
    readonly now: Date;
    /** True when the writer has already finished something in that slot today. */
    readonly wroteMorning: boolean;
    readonly wroteEvening: boolean;
}

/**
 * The reminders worth scheduling for *today*, given what has already happened.
 *
 * A reminder whose time has already passed is not returned: scheduling it would
 * fire immediately or be dropped by the OS, and neither is what the writer
 * asked for. Tomorrow's plan is computed tomorrow.
 */
export function planReminders({ settings, now, wroteMorning, wroteEvening }: PlanInput): ReminderPlan[] {
    const plans: ReminderPlan[] = [];
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const consider = (
        slot: ReminderSlot,
        enabled: boolean,
        at: ReminderTime,
        alreadyWritten: boolean,
    ): void => {
        if (!enabled) return;
        if (settings.skipWhenAlreadyWritten && alreadyWritten) return;
        if (toMinutes(at) <= nowMinutes) return;
        const fireAt = new Date(now.getTime());
        fireAt.setHours(at.hour, at.minute, 0, 0);
        plans.push({
            slot,
            at,
            title: slot === 'morning' ? 'Morning note' : 'Evening close',
            body: slot === 'morning'
                ? 'What wants your attention today?'
                : 'How did today sit with you?',
            fireAt,
        });
    };

    consider('morning', settings.morningEnabled, settings.morning, wroteMorning);
    consider('evening', settings.eveningEnabled, settings.evening, wroteEvening);
    return plans;
}

/** One plain sentence describing what will happen, for the Settings row. */
export function describeReminderSchedule(settings: ReminderSettings): string {
    const parts: string[] = [];
    if (settings.morningEnabled) parts.push(`Morning at ${formatTime(settings.morning)}`);
    if (settings.eveningEnabled) parts.push(`evening at ${formatTime(settings.evening)}`);
    if (parts.length === 0) return 'Off';
    return parts.join(' · ');
}
