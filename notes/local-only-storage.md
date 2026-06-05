# Local-Only Storage

Core journal data is local-only by default. Remote Supabase data sync is preserved
in the codebase, but it is bypassed unless explicitly enabled.

## Provider Switch

The active data provider is resolved in `services/data/dataProvider.ts`.

- Default: `local`
- Enable remote sync: set `EXPO_PUBLIC_DATA_PROVIDER=remote`
- Alternative remote flag: set `EXPO_PUBLIC_ENABLE_REMOTE_DATA_SYNC=true`

Auth screens can still use Supabase directly, but normal app data sync calls go
through `ensureSupabaseSession()` and the sync queue, both of which no-op while
the data provider is local.

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
