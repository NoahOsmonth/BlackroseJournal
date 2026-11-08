import {
    loadReminderSettings,
    parseReminderSettings,
    saveReminderSettings,
    REMINDERS_STORAGE_KEY,
} from '@/services/reminders/remindersStorage';
import { DEFAULT_REMINDER_SETTINGS, type ReminderSettings } from '@/utils/reminders';

const mockStore = new Map<string, string>();

jest.mock('@/services/account/accountScopedStorage', () => ({
    getStorageForAccount: () => ({
        getItem: async (k: string) => mockStore.get(k) ?? null,
        setItem: async (k: string, v: string) => { mockStore.set(k, v); },
        removeItem: async (k: string) => { mockStore.delete(k); },
    }),
}));

jest.mock('@/services/account/accountRuntime', () => ({
    runAccountBoundOperation: async (_owner: string, op: () => Promise<unknown>) => op(),
    requireActiveAccountId: () => 'account-1',
}));

const CUSTOM: ReminderSettings = {
    morningEnabled: true,
    morning: { hour: 7, minute: 30 },
    eveningEnabled: true,
    evening: { hour: 20, minute: 15 },
    skipWhenAlreadyWritten: false,
};

describe('remindersStorage', () => {
    beforeEach(() => mockStore.clear());

    it('returns the defaults before anything is saved', async () => {
        await expect(loadReminderSettings()).resolves.toEqual(DEFAULT_REMINDER_SETTINGS);
    });

    it('round-trips the settings', async () => {
        await saveReminderSettings(CUSTOM);
        await expect(loadReminderSettings()).resolves.toEqual(CUSTOM);
    });

    it('stores a schema version so a later change can migrate', async () => {
        await saveReminderSettings(CUSTOM);
        const stored = JSON.parse(mockStore.get(REMINDERS_STORAGE_KEY) || '{}');
        expect(stored.schemaVersion).toBe(1);
    });

    it('tolerates a corrupted store', async () => {
        mockStore.set(REMINDERS_STORAGE_KEY, '{not json');
        await expect(loadReminderSettings()).resolves.toEqual(DEFAULT_REMINDER_SETTINGS);
    });

    it('falls back rather than half-reading a future schema', async () => {
        mockStore.set(REMINDERS_STORAGE_KEY, JSON.stringify({ schemaVersion: 99, settings: CUSTOM }));
        await expect(loadReminderSettings()).resolves.toEqual(DEFAULT_REMINDER_SETTINGS);
    });

    it('keeps the good fields and defaults the bad ones', () => {
        const parsed = parseReminderSettings({
            morningEnabled: true,
            morning: { hour: 99, minute: 0 },
            eveningEnabled: 'yes',
            skipWhenAlreadyWritten: true,
        });
        expect(parsed.morningEnabled).toBe(true);
        expect(parsed.morning).toEqual(DEFAULT_REMINDER_SETTINGS.morning);
        expect(parsed.eveningEnabled).toBe(DEFAULT_REMINDER_SETTINGS.eveningEnabled);
    });

    it('never accepts an out-of-range hour', () => {
        const parsed = parseReminderSettings({ evening: { hour: -1, minute: 0 } });
        expect(parsed.evening).toEqual(DEFAULT_REMINDER_SETTINGS.evening);
    });
});
