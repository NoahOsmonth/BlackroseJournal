/**
 * Reminder scheduling — the seam between the reminder rules and the OS (Kaneo #9).
 *
 * WHY THIS FILE DOES NOT YET TALK TO A SCHEDULER
 * ------------------------------------------------
 * Local scheduled notifications need `expo-notifications` plus a native build.
 * This repo is on Expo Go / managed config: there is no `android/` or `ios/`
 * directory, and `expo-notifications` is not in the lockfile. Installing it
 * means editing a lockfile, which AGENTS.md puts out of bounds, and the result
 * could not be verified here — scheduled local notifications do not fire in
 * Expo Go on Android.
 *
 * So the decision layer (utils/reminders.ts) and its storage are finished and
 * tested, and this module is the single place a real scheduler plugs in. Until
 * then `applyPlan` is a no-op that reports what it *would* have done, so the
 * Settings screen can be built, reviewed and tested against real behaviour.
 *
 * To finish the feature: add the dependency on a branch that is allowed to
 * touch the lockfile, register the plugin in app.json, then replace the body of
 * `applyPlan` with cancel-all-then-schedule. Nothing else needs to change.
 */

import type { ReminderPlan } from '@/utils/reminders';

export interface ScheduledReminder {
    readonly slot: ReminderPlan['slot'];
    readonly title: string;
    readonly body: string;
    readonly fireAtIso: string;
}

export interface ApplyPlanResult {
    readonly scheduled: ScheduledReminder[];
    /** True once a real scheduler handled the plan. */
    readonly didSchedule: boolean;
}

/**
 * Hand a plan to the OS.
 *
 * Today: returns the plan in ISO form and touches nothing. The caller still
 * gets a truthful answer about what would fire and when.
 */
export async function applyPlan(plans: readonly ReminderPlan[]): Promise<ApplyPlanResult> {
    return {
        scheduled: plans.map((plan) => ({
            slot: plan.slot,
            title: plan.title,
            body: plan.body,
            fireAtIso: plan.fireAt.toISOString(),
        })),
        didSchedule: false,
    };
}

/** Cancel everything this app scheduled. No-op until a scheduler exists. */
export async function cancelAllReminders(): Promise<void> {
    return undefined;
}
