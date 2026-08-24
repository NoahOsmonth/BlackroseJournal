#!/usr/bin/env bash
# Restore an export into a clean Supabase target. Default mode is a local plan;
# --execute performs a preflight and then one transactional restore.
set -eu

usage() {
  echo "Usage: TARGET_DB_URL=postgresql://... $0 BUNDLE_DIRECTORY [--execute]"
  echo "Without --execute, validates the bundle and prints the import plan."
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ] || { [ "$#" -eq 2 ] && [ "$2" != "--execute" ]; }; then
  usage >&2
  exit 2
fi

: "${TARGET_DB_URL:?set TARGET_DB_URL to the percent-encoded target Postgres connection string}"
bundle_dir=$1
for file in roles.sql schema.sql data.sql; do
  if [ ! -f "$bundle_dir/$file" ]; then
    echo "missing bundle file: $file" >&2
    exit 1
  fi
done

if [ -f "$bundle_dir/manifest.txt" ]; then
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$bundle_dir" && sha256sum --check manifest.txt)
  elif command -v shasum >/dev/null 2>&1; then
    (cd "$bundle_dir" && shasum -a 256 --check manifest.txt)
  else
    echo "sha256sum or shasum is required to verify the manifest" >&2
    exit 1
  fi
fi

if [ "${2:-}" != "--execute" ]; then
  echo "DRY RUN: bundle validated; no target connection was opened."
  echo "Re-run with --execute after confirming this is a newly provisioned clean target."
  exit 0
fi

command -v psql >/dev/null 2>&1 || {
  echo "psql is required" >&2
  exit 1
}

target_state=$(psql "$TARGET_DB_URL" --no-psqlrc --tuples-only --no-align --command \
  "select case when to_regclass('public.ai_catalog_models') is null and not exists (select 1 from pg_namespace where nspname = 'control') then 'clean' else 'not-clean' end")
if [ "$target_state" != "clean" ]; then
  echo "refusing import: target already contains Blackrose control-plane objects" >&2
  exit 1
fi

psql \
  --no-psqlrc \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$bundle_dir/roles.sql" \
  --file "$bundle_dir/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$bundle_dir/data.sql" \
  --dbname "$TARGET_DB_URL"

post_state=$(psql "$TARGET_DB_URL" --no-psqlrc --tuples-only --no-align --command \
  "select case when to_regclass('public.ai_catalog_models') is not null and to_regclass('public.ai_catalog_revision') is not null and exists (select 1 from pg_namespace where nspname = 'control') then 'ready' else 'incomplete' end")
if [ "$post_state" != "ready" ]; then
  echo "restore returned without the required control-plane objects" >&2
  exit 1
fi

echo "import complete; verify Realtime publication, RLS, admin access, and gateway health"
