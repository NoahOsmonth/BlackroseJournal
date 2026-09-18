# Local-Only Storage

All app data is local-only. There is no remote data sync, no account server,
and no memory gateway: every write goes to AsyncStorage on the device.

## Identity

The app uses a **device-local account** (`services/auth/localAccount.ts`).

- First launch mints a stable local account id and remembers it in the account
  registry (`@blackrose_account_registry`).
- Later launches re-activate the remembered account.
- The registry already remembered the last account from earlier builds, so data
  written under a previous account id stays readable with no migration.

Storage keys are account-scoped: `@blackrose_account:v1:<accountId>:<key>`.
Legacy unscoped keys (pre-`@blackrose_account` installs) are claimed by the
one-time migration gate (`components/auth/LegacyDataOwnershipGate.tsx`).

## AI Transport

Only the device-direct (BYOK) transport exists. `services/ai/aiTransport.ts`
talks straight to the configured OpenAI-compatible provider
(`EXPO_PUBLIC_NANO_GPT_*`); there is no managed gateway fallback.

## Memory

Long-term memory is entirely on-device (`services/memory/`): memory atoms,
day digests, session digests, rollups, memory files, and the identity profile.
Recall is lexical and offline (`memoryRetrieval.ts`) — no embeddings, no
network, no external bank.

## Legacy Time Provenance

Historical local entries did not capture every timezone, local-date,
week-start, or settled-time field. These records are labelled
`legacy_unknown` and leave those temporal fields null. Only timestamps that
were actually stored are kept; calendar facts are never reconstructed or
invented.

## Local Data Keys

The local backup service snapshots these AsyncStorage keys:

- `@journal_entries`
- `@intentions`
- `@intention_checkins`
- `@goals`
- `@happiness_recipe_items`
- `@personas`
- `@persona_draft_settings`
- `@saved_insights`
- `@weekly_insights_cache`
- `user-theme-preference`
- `user-emoji-preference`

## Backup And Restore

Local backups are stored on the device in AsyncStorage under
`@blackrose_local_backups`.

From Settings:

1. `Create Local Backup` saves a snapshot of the keys above on this device.
2. `Restore Latest Backup` replaces the current values for those keys with the
   latest saved snapshot.
3. If a key was absent when the backup was created, restore removes that key so
   stale local data does not survive accidentally.

The legacy `Export Journal JSON` action remains available, but it only shares
journal entries. It is separate from full local app backup.
