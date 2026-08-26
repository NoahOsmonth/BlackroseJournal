-- Per-user scoped OmniRoute key provisioning (private control plane).
-- This migration is intentionally additive and portable across Supabase-managed
-- and Supabase self-hosted Postgres deployments.

create table if not exists control.user_model_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  omniroute_key_id text not null check (length(omniroute_key_id) between 1 and 512),
  encrypted_key text not null check (length(encrypted_key) between 1 and 8192),
  allowed_models jsonb not null default '[]'::jsonb
    check (jsonb_typeof(allowed_models) = 'array'
      and not exists (
        select 1
        from jsonb_array_elements_text(allowed_models) element
        where length(element) = 0 or length(element) > 240
      )),
  revoked_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

revoke all on control.user_model_keys from public, anon, authenticated;
grant all on control.user_model_keys to service_role;
