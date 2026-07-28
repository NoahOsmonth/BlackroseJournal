begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

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
    select count(*) from public.memory_jobs
    where job_type = 'verify_deletion'
      and idempotency_key = 'deletion:delete-a'
  ),
  1::bigint,
  'deletion enqueues one verifier'
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
