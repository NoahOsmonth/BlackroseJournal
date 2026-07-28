\set ON_ERROR_STOP on

-- TEST ONLY. A database reset removes this helper before production-like runs.
truncate table public.memory_job_attempts, public.memory_jobs
restart identity cascade;

update public.memory_deployment_authority
set
  mode = 'active',
  writer_epoch = 1,
  writer_lease_id = '00000000-0000-4000-8000-000000000077',
  writer_lease_token_digest = encode(
    sha256(convert_to('local-test-writer-token', 'UTF8')),
    'hex'
  ),
  writer_lease_expires_at = clock_timestamp() + interval '1 hour',
  writer_lease_issuer = 'phase0-node-integration',
  writer_lease_key_id = 'phase0-test-key',
  source_credential_fingerprint = 'sha256:local-source',
  change_reason = 'Task 4 local integration'
where singleton;

create or replace function public.memory_test_hold_job_lock(
  p_idempotency_key text,
  p_seconds double precision
) returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform 1
  from public.memory_jobs
  where idempotency_key = p_idempotency_key
  for update;

  if not found then
    raise exception 'TEST_JOB_NOT_FOUND';
  end if;

  perform pg_sleep(p_seconds);
  return true;
end
$function$;

revoke all on function public.memory_test_hold_job_lock(
  text,
  double precision
) from public;
grant execute on function public.memory_test_hold_job_lock(
  text,
  double precision
) to service_role;

notify pgrst, 'reload schema';
