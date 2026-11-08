import { useCallback, useEffect, useState } from 'react';
import {
    loadReminderSettings,
    saveReminderSettings,
} from '@/services/reminders/remindersStorage';
import { applyPlan } from '@/services/reminders/reminderScheduler';
import { useActiveAccountId } from '@/hooks/account/useActiveAccountId';
import {
    DEFAULT_REMINDER_SETTINGS,
    planReminders,
    type ReminderSettings,
} from '@/utils/reminders';

export interface UseRemindersReturn {
    readonly settings: ReminderSettings;
    readonly isLoading: boolean;
    /** What would fire today, given the current settings and clock. */
    readonly plannedCount: number;
    readonly update: (patch: Partial<ReminderSettings>) => Promise<void>;
}

/**
 * Reminder settings for the Settings screen (Kaneo #9).
 *
 * Saving always re-plans and hands the result to the scheduler seam, so what
 * the screen shows and what the OS would do come from one calculation.
 */
export function useReminders(): UseRemindersReturn {
    const accountId = useActiveAccountId();
    const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        if (!accountId) {
            setIsLoading(false);
            return () => { cancelled = true; };
        }
        void (async () => {
            const loaded = await loadReminderSettings();
            if (!cancelled) {
                setSettings(loaded);
                setIsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [accountId]);

    const update = useCallback(async (patch: Partial<ReminderSettings>) => {
        const next = { ...settings, ...patch };
        setSettings(next);
        try {
            await saveReminderSettings(next);
            const plan = planReminders({
                settings: next,
                now: new Date(),
                // Written-today state belongs to the caller that knows the entries;
                // a settings save plans optimistically.
                wroteMorning: false,
                wroteEvening: false,
            });
            await applyPlan(plan);
        } catch {
            // A failed save must not strand the screen: it already shows `next`.
        }
    }, [settings]);

    const plannedCount = planReminders({
        settings,
        now: new Date(),
        wroteMorning: false,
        wroteEvening: false,
    }).length;

    return { settings, isLoading, plannedCount, update };
}
