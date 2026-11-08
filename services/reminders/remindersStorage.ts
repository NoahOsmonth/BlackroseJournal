/**
 * Reminder settings — storage (Kaneo #9).
 *
 * One account-scoped key, `@blackrose_reminders`, behind a single mutation
 * queue. The stored shape carries a schemaVersion so a later change can
 * migrate instead of guessing (AGENTS.md rule 4).
 */

import { AccountStorageAdapter, getStorageForAccount } from '@/services/account/accountScopedStorage';
import { requireActiveAccountId, runAccountBoundOperation } from '@/services/account/accountRuntime';
import { DEFAULT_REMINDER_SETTINGS, type ReminderSettings, type ReminderTime } from '@/utils/reminders';

export const REMINDERS_STORAGE_KEY = '@blackrose_reminders';
const SCHEMA_VERSION = 1;

let mutationQueue: Promise<void> = Promise.resolve();

function storage(): AccountStorageAdapter {
    return getStorageForAccount(requireActiveAccountId());
}

function isTime(value: unknown): value is ReminderTime {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return typeof v.hour === 'number' && v.hour >= 0 && v.hour <= 23
        && typeof v.minute === 'number' && v.minute >= 0 && v.minute <= 59;
}

/**
 * Any stored field that is missing or malformed falls back to the default —
 * a corrupt reminder setting must never stop the app, and a bad hour must never
 * schedule a notification at 3 am.
 */
export function parseReminderSettings(raw: unknown): ReminderSettings {
    if (!raw || typeof raw !== 'object') return DEFAULT_REMINDER_SETTINGS;
    const v = raw as Record<string, unknown>;
    const pickBool = (key: keyof ReminderSettings, fallback: boolean): boolean =>
        typeof v[key] === 'boolean' ? (v[key] as boolean) : fallback;
    const pickTime = (key: 'morning' | 'evening'): ReminderTime =>
        isTime(v[key]) ? (v[key] as ReminderTime) : DEFAULT_REMINDER_SETTINGS[key];
    return {
        morningEnabled: pickBool('morningEnabled', DEFAULT_REMINDER_SETTINGS.morningEnabled),
        morning: pickTime('morning'),
        eveningEnabled: pickBool('eveningEnabled', DEFAULT_REMINDER_SETTINGS.eveningEnabled),
        evening: pickTime('evening'),
        skipWhenAlreadyWritten: pickBool('skipWhenAlreadyWritten', DEFAULT_REMINDER_SETTINGS.skipWhenAlreadyWritten),
    };
}

export async function loadReminderSettings(): Promise<ReminderSettings> {
    return runAccountBoundOperation('reminders-read', async () => {
        try {
            const raw = await storage().getItem(REMINDERS_STORAGE_KEY);
            if (!raw) return DEFAULT_REMINDER_SETTINGS;
            const parsed = JSON.parse(raw) as unknown;
            if (!parsed || typeof parsed !== 'object') return DEFAULT_REMINDER_SETTINGS;
            const envelope = parsed as { schemaVersion?: number; settings?: unknown };
            // A future schema is not something this build can reason about;
            // fall back rather than half-read it.
            if (envelope.schemaVersion !== SCHEMA_VERSION) return DEFAULT_REMINDER_SETTINGS;
            return parseReminderSettings(envelope.settings);
        } catch {
            return DEFAULT_REMINDER_SETTINGS;
        }
    });
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
    await runAccountBoundOperation('reminders-write', async () => {
        const run = mutationQueue.then(async () => {
            await storage().setItem(
                REMINDERS_STORAGE_KEY,
                JSON.stringify({ schemaVersion: SCHEMA_VERSION, settings }),
            );
        });
        mutationQueue = run.then(() => undefined, () => undefined);
        await run;
    });
}
