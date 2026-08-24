#!/usr/bin/env bash
# Logical, read-only Supabase export. The bundle contains encrypted provider
# credential rows, but deliberately never contains their server-side key ring.
set -eu

usage() {
  echo "Usage: SOURCE_DB_URL=postgresql://... $0 OUTPUT_DIRECTORY"
  echo "Creates a new roles/schema/data bundle; OUTPUT_DIRECTORY must not exist."
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

if [ "$#" -ne 1 ]; then
  usage >&2
  exit 2
fi

: "${SOURCE_DB_URL:?set SOURCE_DB_URL to the percent-encoded source Postgres connection string}"
command -v supabase >/dev/null 2>&1 || {
  echo "supabase CLI is required" >&2
  exit 1
}

output_dir=$1
if [ -e "$output_dir" ]; then
  echo "refusing to overwrite existing path: $output_dir" >&2
  exit 1
fi

umask 077
mkdir -m 700 "$output_dir"

supabase db dump --db-url "$SOURCE_DB_URL" --file "$output_dir/roles.sql" --role-only
supabase db dump --db-url "$SOURCE_DB_URL" --file "$output_dir/schema.sql"
supabase db dump \
  --db-url "$SOURCE_DB_URL" \
  --file "$output_dir/data.sql" \
  --use-copy \
  --data-only \
  --exclude storage.buckets_vectors \
  --exclude storage.vector_indexes

chmod 600 "$output_dir/roles.sql" "$output_dir/schema.sql" "$output_dir/data.sql"
if command -v sha256sum >/dev/null 2>&1; then
  (
    cd "$output_dir"
    sha256sum roles.sql schema.sql data.sql > manifest.txt
  )
elif command -v shasum >/dev/null 2>&1; then
  (
    cd "$output_dir"
    shasum -a 256 roles.sql schema.sql data.sql > manifest.txt
  )
else
  echo "sha256sum or shasum is required" >&2
  exit 1
fi
chmod 600 "$output_dir/manifest.txt"

echo "export complete: $output_dir"
echo "store the credential key ring separately in the secret manager"
