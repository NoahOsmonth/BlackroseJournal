import { getActiveAccountId } from './accountRuntime';
import {
    hasLegacyGoals,
    migrateLegacyGoalsToActiveAccount,
} from '@/services/goals/goalsStorage';
import {
    hasLegacyIntentions,
    migrateLegacyIntentionsToActiveAccount,
} from '@/services/intentions/intentionsStorage';
import {
    hasLegacyJournalEntries,
    migrateLegacyJournalEntriesToActiveAccount,
} from '@/services/journal/journalStorage';

export async function hasUnclaimedLegacyData(): Promise<boolean> {
    const results = await Promise.all([
        hasLegacyJournalEntries(),
        hasLegacyGoals(),
        hasLegacyIntentions(),
    ]);
    return results.some(Boolean);
}

export async function confirmLegacyDataOwnership(accountId: string): Promise<void> {
    if (getActiveAccountId() !== accountId) {
        throw new Error('Legacy data can only be claimed by the active authenticated account.');
    }
    await migrateLegacyJournalEntriesToActiveAccount();
    await migrateLegacyGoalsToActiveAccount();
    await migrateLegacyIntentionsToActiveAccount();
}
