begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

truncate table
  public.memory_job_attempts,
  public.memory_jobs,
  public.memory_evidence_spans,
  public.memory_deletion_ledger,
  public.memory_import_chunks,
  public.memory_import_manifests,
  public.memory_source_watermarks,
  public.turn_traces,
  public.memory_messages,
  public.memory_conversations,
  public.memory_owner_state
restart identity cascade;

select extensions.has_table(
  'public',
  'memory_deployment_authority',
  'deployment authority exists'
);
select extensions.has_table('public', 'memory_jobs', 'job table exists');
select extensions.has_function(
  'public',
  'memory_assert_writer',
  array['text', 'bigint', 'uuid', 'text', 'text'],
  'writer assertion has the fenced signature'
);
select extensions.has_function(
  'public',
  'memory_claim_jobs',
  array['text', 'bigint', 'uuid', 'text', 'text', 'text', 'integer', 'integer'],
  'claim RPC has the fenced signature'
);

select extensions.throws_ok(
  $$insert into public.memory_owner_state (owner_id, feature_flags)
    values (
      '00000000-0000-4000-8000-00000000000a',
      '{"cloudSourceMirroring":false}'::jsonb
    )$$,
  '23514',
  null,
  'missing feature-flag keys are rejected'
);
select extensions.throws_ok(
  $$insert into public.memory_owner_state (owner_id, feature_flags)
    values (
      '00000000-0000-4000-8000-00000000000a',
      '{
        "cloudSourceMirroring":false,
        "cloudProjectionBuild":false,
        "shadowRetrieval":false,
        "cloudReadAuthority":false,
        "cloudWriteAuthority":null
      }'::jsonb
    )$$,
  '23514',
  null,
  'JSON-null feature flags are rejected'
);
select extensions.throws_ok(
  $$insert into public.memory_owner_state (owner_id, feature_flags)
    values (
      '00000000-0000-4000-8000-00000000000a',
      '{
        "cloudSourceMirroring":false,
        "cloudProjectionBuild":false,
        "shadowRetrieval":false,
        "cloudReadAuthority":false,
        "cloudWriteAuthority":false,
        "unexpected":true
      }'::jsonb
    )$$,
  '23514',
  null,
  'extra feature-flag keys are rejected'
);

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
  writer_lease_issuer = 'phase0-pgtap',
  writer_lease_key_id = 'phase0-test-key',
  source_credential_fingerprint = 'sha256:local-source'
where singleton;

insert into public.memory_conversations (
  owner_id,
  id,
  source_kind,
  source_record_id,
  status,
  started_at,
  temporal_provenance,
  client_schema_version
) values
(
  '00000000-0000-4000-8000-00000000000a',
  'conversation-a',
  'journal',
  'entry-a',
  'settled',
  '2026-07-01T01:00:00Z',
  'legacy_unknown',
  1
),
(
  '00000000-0000-4000-8000-00000000000b',
  'conversation-b',
  'journal',
  'entry-b',
  'settled',
  '2026-07-01T01:00:00Z',
  'legacy_unknown',
  1
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-00000000000a',
  true
);
select extensions.is(
  (select array_agg(id order by id) from public.memory_conversations),
  array['conversation-a']::text[],
  'owner A sees only owner A'
);
select extensions.throws_ok(
  $$select * from public.memory_claim_jobs(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    'forbidden-worker', 1, 60
  )$$,
  '42501',
  null,
  'authenticated cannot execute service-only claim RPC'
);
reset role;

select extensions.throws_ok(
  $$select public.memory_assert_writer(
    null, 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source'
  )$$,
  'P0001',
  'MEMORY_DEPLOYMENT_MISMATCH',
  'null deployment cannot bypass the fence'
);
select extensions.throws_ok(
  $$select public.memory_assert_writer(
    'blackrose-primary', null, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source'
  )$$,
  'P0001',
  'MEMORY_STALE_WRITER_EPOCH',
  'null epoch cannot bypass the fence'
);
select extensions.throws_ok(
  $$select public.memory_assert_writer(
    'blackrose-primary', 0, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source'
  )$$,
  'P0001',
  'MEMORY_STALE_WRITER_EPOCH',
  'stale epoch is rejected'
);
select extensions.throws_ok(
  $$select * from public.memory_enqueue_job(
    'blackrose-primary', 0,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'capture_source', 'stale-epoch', 'v1', '{}'::jsonb, 0, 2
  )$$,
  'P0001',
  'MEMORY_STALE_WRITER_EPOCH',
  'stale writer epoch cannot enqueue'
);

update public.memory_deployment_authority
set mode = 'maintenance'
where singleton;
select extensions.throws_ok(
  $$select * from public.memory_enqueue_job(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'capture_source', 'maintenance', 'v1', '{}'::jsonb, 0, 2
  )$$,
  'P0001',
  'MEMORY_WRITES_DISABLED',
  'maintenance mode rejects mutations'
);
update public.memory_deployment_authority
set mode = 'active'
where singleton;

select extensions.throws_ok(
  $$select * from public.memory_enqueue_job(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000078',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'capture_source', 'wrong-lease', 'v1', '{}'::jsonb, 0, 2
  )$$,
  'P0001',
  'MEMORY_WRITER_LEASE_MISMATCH',
  'foreign writer lease ID is rejected'
);
select extensions.throws_ok(
  $$select * from public.memory_enqueue_job(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'wrong-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'capture_source', 'wrong-token', 'v1', '{}'::jsonb, 0, 2
  )$$,
  'P0001',
  'MEMORY_WRITER_LEASE_TOKEN_INVALID',
  'wrong writer lease token is rejected'
);
select extensions.throws_ok(
  $$select * from public.memory_begin_import(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'wrong-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'wrong-token-manifest', 1, 0, 0, 'sha256:empty'
  )$$,
  'P0001',
  'MEMORY_WRITER_LEASE_TOKEN_INVALID',
  'import writes use the same writer lease fence'
);
select extensions.throws_ok(
  $$select * from public.memory_enqueue_job(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:wrong-source',
    '00000000-0000-4000-8000-00000000000a',
    'capture_source', 'wrong-source', 'v1', '{}'::jsonb, 0, 2
  )$$,
  'P0001',
  'MEMORY_SOURCE_CREDENTIAL_MISMATCH',
  'wrong source credential fingerprint is rejected'
);

update public.memory_deployment_authority
set writer_lease_expires_at = clock_timestamp() - interval '1 second'
where singleton;
select extensions.throws_ok(
  $$select * from public.memory_enqueue_job(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'capture_source', 'expired-writer', 'v1', '{}'::jsonb, 0, 2
  )$$,
  'P0001',
  'MEMORY_WRITER_LEASE_EXPIRED',
  'expired writer lease is rejected'
);
update public.memory_deployment_authority
set writer_lease_expires_at = clock_timestamp() + interval '1 hour'
where singleton;

select extensions.lives_ok(
  $$select * from public.memory_enqueue_job(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'capture_source', 'same', 'v1', '{"sourceId":"entry-a"}'::jsonb, 20, 2
  )$$,
  'first enqueue succeeds'
);
select extensions.lives_ok(
  $$select * from public.memory_enqueue_job(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'capture_source', 'same', 'v1', '{"sourceId":"entry-a"}'::jsonb, 20, 2
  )$$,
  'content-equivalent enqueue replays'
);
select extensions.throws_ok(
  $$select * from public.memory_enqueue_job(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'capture_source', 'same', 'v1', '{"sourceId":"different"}'::jsonb, 20, 2
  )$$,
  'PT409',
  'MEMORY_IDEMPOTENCY_CONFLICT',
  'changed enqueue payload conflicts'
);
select extensions.is(
  (select count(*) from public.memory_jobs where idempotency_key = 'same'),
  1::bigint,
  'content-equivalent enqueue creates only one row'
);

select extensions.lives_ok(
  $$select * from public.memory_begin_import(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'manifest-a', 1, 1, 0, 'sha256:manifest'
  )$$,
  'manifest begins'
);
select extensions.lives_ok(
  $$select * from public.memory_begin_import(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'manifest-a', 1, 1, 0, 'sha256:manifest'
  )$$,
  'content-equivalent manifest replay returns the existing row'
);
select extensions.throws_ok(
  $$select * from public.memory_begin_import(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'manifest-a', 1, 2, 0, 'sha256:changed'
  )$$,
  'PT409',
  'MEMORY_IDEMPOTENCY_CONFLICT',
  'changed manifest conflicts'
);

select extensions.lives_ok(
  $$select * from public.memory_accept_import_chunk(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'manifest-a', 0, 'chunk-a', 1, 'sha256:chunk-a',
    12, 'event-12', 'journal', '2026-07-28T00:00:00Z'
  )$$,
  'chunk and watermark commit together'
);
select extensions.lives_ok(
  $$select * from public.memory_accept_import_chunk(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'manifest-a', 0, 'chunk-a', 1, 'sha256:chunk-a',
    12, 'event-12', 'journal', '2026-07-28T00:00:00Z'
  )$$,
  'content-equivalent chunk replay returns the existing row'
);
select extensions.throws_ok(
  $$select * from public.memory_accept_import_chunk(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'manifest-a', 0, 'chunk-a', 1, 'sha256:changed',
    12, 'event-12', 'journal', '2026-07-28T00:00:00Z'
  )$$,
  'PT409',
  'MEMORY_IDEMPOTENCY_CONFLICT',
  'changed chunk replay conflicts'
);
select extensions.throws_ok(
  $$select * from public.memory_accept_import_chunk(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'manifest-a', 1, 'chunk-b', 1, 'sha256:chunk-b',
    12, 'different-event-12', 'journal', '2026-07-28T00:01:00Z'
  )$$,
  'PT409',
  'MEMORY_SOURCE_WATERMARK_CONFLICT',
  'equal sequence with a different event conflicts'
);
select extensions.is(
  (
    select highest_client_sequence
    from public.memory_source_watermarks
    where owner_id = '00000000-0000-4000-8000-00000000000a'
      and source_kind = 'journal'
  ),
  12::bigint,
  'source high watermark is durable'
);

select extensions.lives_ok(
  $$select * from public.memory_record_deletion(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'journal', 'entry-a', 1, 'delete-a',
    '2026-07-28T00:02:00Z', 'USER_DELETE'
  )$$,
  'deletion is recorded'
);
select extensions.lives_ok(
  $$select * from public.memory_record_deletion(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'journal', 'entry-a', 1, 'delete-a',
    '2026-07-28T00:02:00Z', 'USER_DELETE'
  )$$,
  'content-equivalent deletion replay returns the existing tombstone'
);
select extensions.throws_ok(
  $$select * from public.memory_record_deletion(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'journal', 'entry-a', 1, 'delete-a',
    '2026-07-28T00:02:00Z', 'CHANGED'
  )$$,
  'PT409',
  'MEMORY_IDEMPOTENCY_CONFLICT',
  'changed deletion replay conflicts'
);
select extensions.is(
  (
    select verification_status
    from public.memory_deletion_ledger
    where owner_id = '00000000-0000-4000-8000-00000000000a'
      and client_event_id = 'delete-a'
  ),
  'pending',
  'Phase 0 records but does not falsely verify deletion'
);
select extensions.is(
  (
    select count(*) from public.memory_jobs
    where job_type = 'verify_deletion'
      and idempotency_key = 'deletion:delete-a'
  ),
  1::bigint,
  'deletion enqueues one verifier'
);

create temporary table first_claim as
select id, lease_token
from public.memory_claim_jobs(
  'blackrose-primary', 1,
  '00000000-0000-4000-8000-000000000077',
  'local-test-writer-token', 'sha256:local-source',
  'worker-a', 1, 15
);
select extensions.is(
  (select count(*) from first_claim),
  1::bigint,
  'first claim leases one job'
);

update public.memory_jobs
set
  lease_started_at = clock_timestamp() - interval '2 seconds',
  lease_expires_at = clock_timestamp() - interval '1 second'
where id = (select id from first_claim);

create temporary table second_claim as
select id, lease_token
from public.memory_claim_jobs(
  'blackrose-primary', 1,
  '00000000-0000-4000-8000-000000000077',
  'local-test-writer-token', 'sha256:local-source',
  'worker-b', 1, 15
);
select extensions.is(
  (select count(*) from second_claim),
  1::bigint,
  'expired leased job is reclaimed'
);
select extensions.is(
  (
    select worker_id
    from public.memory_jobs
    where id = (select id from first_claim)
  ),
  'worker-b',
  'reclaim transfers the job to the second worker'
);
select extensions.throws_ok(
  format(
    $$select * from public.memory_finish_job(
      'blackrose-primary', 1,
      '00000000-0000-4000-8000-000000000077',
      'local-test-writer-token', 'sha256:local-source',
      %s, 'worker-a', %L::uuid,
      'succeeded', null, 15, null, null, '{}'::jsonb,
      null, 1, now(), '{}'::jsonb
    )$$,
    (select id from first_claim),
    (select lease_token from first_claim)
  ),
  'P0001',
  'MEMORY_STALE_JOB_LEASE',
  'stale worker and lease token cannot finish a reclaimed job'
);
select extensions.lives_ok(
  format(
    $$select * from public.memory_finish_job(
      'blackrose-primary', 1,
      '00000000-0000-4000-8000-000000000077',
      'local-test-writer-token', 'sha256:local-source',
      %s, 'worker-b', %L::uuid,
      'retryable', 'TRANSIENT', 15, null, null, '{}'::jsonb,
      503, 1, now() - interval '1 second', '{}'::jsonb
    )$$,
    (select id from second_claim),
    (select lease_token from second_claim)
  ),
  'current lease finishes atomically'
);
select extensions.is(
  (
    select status
    from public.memory_jobs
    where id = (select id from first_claim)
  ),
  'dead_letter',
  'max attempts convert retryable to dead letter'
);
select extensions.is(
  (
    select count(*)
    from public.memory_job_attempts
    where job_id = (select id from first_claim)
  ),
  2::bigint,
  'expired lease and final transition each record one attempt'
);
select extensions.is(
  (
    select count(*)
    from public.memory_job_attempts
    where job_id = (select id from first_claim)
      and error_code = 'JOB_LEASE_EXPIRED'
  ),
  1::bigint,
  'expired lease recovery preserves abandoned attempt history'
);

insert into public.turn_traces (
  owner_id,
  id,
  conversation_id,
  authority_state,
  route,
  status
) values (
  '00000000-0000-4000-8000-00000000000a',
  'trace-a',
  'conversation-a',
  'LOCAL',
  'local',
  'complete'
);
delete from public.memory_conversations
where owner_id = '00000000-0000-4000-8000-00000000000a'
  and id = 'conversation-a';
select extensions.is(
  (select owner_id from public.turn_traces where id = 'trace-a'),
  '00000000-0000-4000-8000-00000000000a'::uuid,
  'trace owner survives parent deletion'
);
select extensions.is(
  (select conversation_id from public.turn_traces where id = 'trace-a'),
  null,
  'PostgreSQL 17 nulls only the conversation column'
);

select extensions.ok(
  not has_table_privilege('service_role', 'public.memory_jobs', 'INSERT'),
  'service role cannot write tables directly'
);
select extensions.ok(
  has_function_privilege(
    'service_role',
    'public.memory_enqueue_job(text,bigint,uuid,text,text,uuid,text,text,text,jsonb,integer,integer)',
    'EXECUTE'
  ),
  'service role can execute the fenced enqueue RPC'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.memory_enqueue_job(text,bigint,uuid,text,text,uuid,text,text,text,jsonb,integer,integer)',
    'EXECUTE'
  ),
  'authenticated cannot execute mutators'
);
select extensions.has_index(
  'public',
  'memory_jobs',
  'memory_jobs_claim_ready_idx',
  'global ready-claim index exists'
);
select extensions.has_index(
  'public',
  'memory_jobs',
  'memory_jobs_claim_expired_idx',
  'global expired-lease index exists'
);
select extensions.has_index(
  'public',
  'memory_evidence_spans',
  'memory_evidence_spans_created_by_job_idx',
  'evidence-span job foreign key has a covering index'
);
select extensions.has_index(
  'public',
  'turn_traces',
  'turn_traces_conversation_idx',
  'turn-trace conversation foreign key has a covering index'
);

select * from extensions.finish();
rollback;
