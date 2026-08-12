-- Supabase overlay for 0003_memory_mirror_ingestion.sql.
-- Forces RLS on every new Phase 1 table, fences direct table mutation from
-- public/anon/authenticated/service_role, and grants each Phase 1 SECURITY
-- DEFINER RPC to service_role only.

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'memory_mirror_owner_allowlist',
    'memory_mirror_rate_limits',
    'memory_conversation_revisions',
    'memory_import_items',
    'memory_import_completion_permits'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated '
      || 'using ((select auth.uid()) = owner_id)',
      table_name || '_owner_select',
      table_name
    );
  end loop;
  -- memory_import_manifests / memory_import_chunks already carry owner-access
  -- policies from the Phase 0 overlay (0001); do not recreate them here.
end
$$;

revoke all on table
  public.memory_mirror_owner_allowlist,
  public.memory_mirror_rate_limits,
  public.memory_conversation_revisions,
  public.memory_import_items,
  public.memory_import_completion_permits,
  public.memory_current_source_conversations,
  public.memory_current_source_messages
from public, anon, authenticated, service_role;

grant select on table
  public.memory_current_source_conversations,
  public.memory_current_source_messages
to authenticated;

revoke all on function public.memory_enroll_mirror_v1(
  text, bigint, uuid, text, text, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.memory_reserve_mirror_request_v1(
  text, bigint, uuid, text, text, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.memory_begin_source_import_v1(
  text, bigint, uuid, text, text, uuid, uuid, text, uuid, integer, bigint,
  integer, integer, integer, text
) from public, anon, authenticated, service_role;
revoke all on function public.memory_accept_source_chunk_v1(
  text, bigint, uuid, text, text, uuid, uuid, text, integer, jsonb, text
) from public, anon, authenticated, service_role;
revoke all on function public.memory_get_source_import_v1(
  uuid, uuid, text
) from public, anon, authenticated, service_role;
revoke all on function public.memory_cancel_source_import_v1(
  text, bigint, uuid, text, text, uuid, uuid, text
) from public, anon, authenticated, service_role;
revoke all on function public.memory_validate_source_import_v1(
  text, bigint, uuid, text, text, uuid, uuid, text
) from public, anon, authenticated, service_role;
revoke all on function public.memory_prepare_source_completion_v1(
  text, bigint, uuid, text, text, uuid, uuid, text, bigint
) from public, anon, authenticated, service_role;
revoke all on function public.memory_complete_source_import_v1(
  text, bigint, uuid, text, text, uuid, uuid, text, uuid, bigint, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.memory_apply_source_tombstone_v1(
  text, bigint, uuid, text, text, uuid, uuid, text, text, integer, integer,
  text, timestamptz, text
) from public, anon, authenticated, service_role;
revoke all on function public.memory_get_source_parity_v1(
  uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.memory_deterministic_json_hash(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.memory_canonical_mirror_chunk(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.memory_canonical_mirror_chunk_hash(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.memory_assert_mirror_owner_access(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.memory_assert_mirror_revision(
  integer, integer, integer, boolean
) from public, anon, authenticated, service_role;
revoke all on function public.memory_mirror_refresh_owner_union(uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.memory_enroll_mirror_v1(
  text, bigint, uuid, text, text, uuid, uuid, uuid
) to service_role;
grant execute on function public.memory_reserve_mirror_request_v1(
  text, bigint, uuid, text, text, uuid, uuid
) to service_role;
grant execute on function public.memory_begin_source_import_v1(
  text, bigint, uuid, text, text, uuid, uuid, text, uuid, integer, bigint,
  integer, integer, integer, text
) to service_role;
grant execute on function public.memory_accept_source_chunk_v1(
  text, bigint, uuid, text, text, uuid, uuid, text, integer, jsonb, text
) to service_role;
grant execute on function public.memory_get_source_import_v1(
  uuid, uuid, text
) to service_role;
grant execute on function public.memory_cancel_source_import_v1(
  text, bigint, uuid, text, text, uuid, uuid, text
) to service_role;
grant execute on function public.memory_validate_source_import_v1(
  text, bigint, uuid, text, text, uuid, uuid, text
) to service_role;
grant execute on function public.memory_prepare_source_completion_v1(
  text, bigint, uuid, text, text, uuid, uuid, text, bigint
) to service_role;
grant execute on function public.memory_complete_source_import_v1(
  text, bigint, uuid, text, text, uuid, uuid, text, uuid, bigint, text, text
) to service_role;
grant execute on function public.memory_apply_source_tombstone_v1(
  text, bigint, uuid, text, text, uuid, uuid, text, text, integer, integer,
  text, timestamptz, text
) to service_role;
grant execute on function public.memory_get_source_parity_v1(
  uuid, uuid
) to service_role;
