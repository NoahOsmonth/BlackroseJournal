do $$
declare table_name text;
begin
  foreach table_name in array array[
    'memory_owner_state', 'memory_source_watermarks', 'memory_deletion_ledger',
    'memory_conversations', 'memory_messages',
    'memory_message_revisions', 'memory_evidence_spans',
    'memory_import_manifests', 'memory_import_chunks',
    'memory_jobs', 'memory_job_attempts', 'turn_traces'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using ((select auth.uid()) = owner_id) '
      || 'with check ((select auth.uid()) = owner_id)',
      table_name || '_owner_access',
      table_name
    );
  end loop;
end
$$;

alter table public.memory_deployment_authority enable row level security;
alter table public.memory_deployment_authority force row level security;

revoke all on table
  public.memory_deployment_authority,
  public.memory_owner_state,
  public.memory_source_watermarks,
  public.memory_deletion_ledger,
  public.memory_conversations,
  public.memory_messages,
  public.memory_message_revisions,
  public.memory_evidence_spans,
  public.memory_import_manifests,
  public.memory_import_chunks,
  public.memory_jobs,
  public.memory_job_attempts,
  public.turn_traces
from public, anon, authenticated, service_role;

grant select on table
  public.memory_owner_state,
  public.memory_source_watermarks,
  public.memory_deletion_ledger,
  public.memory_conversations,
  public.memory_messages
to authenticated;

revoke all on function public.memory_assert_writer(text, bigint, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.memory_enqueue_job(
  text, bigint, uuid, text, text, uuid, text, text, text, jsonb, integer, integer
) from public, anon, authenticated;
revoke all on function public.memory_claim_jobs(
  text, bigint, uuid, text, text, text, integer, integer
)
  from public, anon, authenticated;
revoke all on function public.memory_finish_job(
  text, bigint, uuid, text, text, bigint, text, uuid, text, text, integer,
  text, text, jsonb, integer, integer, timestamptz, jsonb
) from public, anon, authenticated;
revoke all on function public.memory_begin_import(
  text, bigint, uuid, text, text, uuid, text, integer, integer, integer, text
) from public, anon, authenticated;
revoke all on function public.memory_accept_import_chunk(
  text, bigint, uuid, text, text, uuid, text, integer, text, integer, text,
  bigint, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.memory_record_deletion(
  text, bigint, uuid, text, text, uuid, text, text, integer, text,
  timestamptz, text
) from public, anon, authenticated;
revoke all on function public.memory_get_bootstrap()
  from public, anon, authenticated;
revoke all on function public.memory_get_owner_state(uuid)
  from public, anon, authenticated;
revoke all on function public.memory_get_source_inventory(uuid)
  from public, anon, authenticated;

grant execute on function public.memory_enqueue_job(
  text, bigint, uuid, text, text, uuid, text, text, text, jsonb, integer, integer
) to service_role;
grant execute on function public.memory_claim_jobs(
  text, bigint, uuid, text, text, text, integer, integer
)
  to service_role;
grant execute on function public.memory_finish_job(
  text, bigint, uuid, text, text, bigint, text, uuid, text, text, integer,
  text, text, jsonb, integer, integer, timestamptz, jsonb
) to service_role;
grant execute on function public.memory_begin_import(
  text, bigint, uuid, text, text, uuid, text, integer, integer, integer, text
) to service_role;
grant execute on function public.memory_accept_import_chunk(
  text, bigint, uuid, text, text, uuid, text, integer, text, integer, text,
  bigint, text, text, timestamptz
) to service_role;
grant execute on function public.memory_record_deletion(
  text, bigint, uuid, text, text, uuid, text, text, integer, text,
  timestamptz, text
) to service_role;
grant execute on function public.memory_get_bootstrap() to service_role;
grant execute on function public.memory_get_owner_state(uuid) to service_role;
grant execute on function public.memory_get_source_inventory(uuid) to service_role;
