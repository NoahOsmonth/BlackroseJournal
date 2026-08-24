import { getActiveAccountId } from './accountRuntime';
import {
    claimLegacyStorageKey,
    claimLegacyStoragePrefix,
    hasLegacyStorage,
} from './accountScopedStorage';
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
import {
    hasLegacySyncQueue,
    migrateLegacySyncQueueToActiveAccount,
} from '@/services/supabase/syncQueue';

const ACCOUNT_PRIVATE_EXACT_KEYS = [
    '@happiness_recipe_items',
    '@personas',
    '@persona_draft_settings',
    '@ai_response_feedback',
    '@rosebud_local_memory',
    '@rosebud_local_memory_corrupt',
    '@rosebud_identity_profile',
    '@rosebud_identity_profile_corrupt',
    '@blackrose_day_digests',
    '@blackrose_day_digests_corrupt',
    '@rosebud_session_digest_index',
    '@rosebud_memory_rollup_index',
    '@rosebud_memory_rollup_attempts',
    '@saved_insights',
    '@weekly_insights_cache',
    '@blackrose_custom_ai_provider',
    '@blackrose_generation_settings',
    '@blackrose_model_context_cache',
    '@blackrose_chat_sessions',
    '@demo_data_seed_record',
    '@demo_data_seeded',
    '@blackrose_local_backups',
] as const;

const ACCOUNT_PRIVATE_KEY_PREFIXES = [
    '@rosebud_session_digest:',
    '@rosebud_memory_rollup:',
    '@blackrose_local_backup_session_digest:',
] as const;

export async function hasUnclaimedLegacyData(): Promise<boolean> {
    const results = await Promise.all([
        hasLegacyJournalEntries(),
        hasLegacyGoals(),
        hasLegacyIntentions(),
        hasLegacyStorage(ACCOUNT_PRIVATE_EXACT_KEYS, ACCOUNT_PRIVATE_KEY_PREFIXES),
        hasLegacySyncQueue(),
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
    for (const key of ACCOUNT_PRIVATE_EXACT_KEYS) {
        await claimLegacyStorageKey(key);
    }
    for (const prefix of ACCOUNT_PRIVATE_KEY_PREFIXES) {
        await claimLegacyStoragePrefix(prefix);
    }
    await migrateLegacySyncQueueToActiveAccount();
}
