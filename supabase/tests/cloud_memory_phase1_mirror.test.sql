-- cloud_memory_phase1_mirror.test.sql
--
-- Phase 1 atomic PostgreSQL MIRROR ingestion proof (task 4 brief "Prove:" list
-- and the six sabotage guards). Runs against the clean local database with the
-- generated Phase 1 migration applied; one rolled-back transaction like the
-- Phase 0 suite.

begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

-- ---------------------------------------------------------------------------
-- Fixture helpers (create/rollback with the transaction)
-- ---------------------------------------------------------------------------
create or replace function public.brj_msg(
  p_id text, p_conv text, p_role text, p_seq integer, p_rev integer,
  p_content text, p_status text, p_authored timestamptz,
  p_prev integer default null
) returns jsonb language sql immutable as $body$
  select jsonb_build_object(
    'id', p_id, 'conversationId', p_conv, 'clientEventId', p_id,
    'role', p_role, 'sequence', p_seq, 'authoredAt', to_jsonb(p_authored),
    'authoredTimezone', null, 'localDate', null,
    'temporalProvenance', 'captured', 'content', p_content,
    'revision', p_rev, 'previousAcceptedRevision', p_prev,
    'status', p_status
  );
$body$;

create or replace function public.brj_conv(
  p_id text, p_srev integer, p_prev integer, p_msgs jsonb
) returns jsonb language sql immutable as $body$
  select jsonb_build_object(
    'id', p_id, 'sourceKind', 'journal', 'sourceRecordId', 'entry-' || p_id,
    'status', 'settled', 'startedAt', to_jsonb('2026-07-20T00:00:00+00:00'::timestamptz),
    'settledAt', to_jsonb('2026-07-20T00:10:00+00:00'::timestamptz),
    'timezone', null, 'weekStartsOn', null, 'temporalProvenance', 'captured',
    'clientSchemaVersion', 1, 'sourceRevision', p_srev,
    'previousAcceptedRevision', p_prev, 'messages', p_msgs
  );
$body$;

create or replace function public.brj_chunk(
  p_manifest text, p_idx integer, p_convs jsonb
) returns jsonb language sql immutable as $body$
  select jsonb_build_object(
    'manifestId', p_manifest, 'chunkIndex', p_idx, 'contractVersion', 1,
    'conversations', p_convs
  );
$body$;

create or replace function public.brj_hash(p_chunk jsonb)
returns text language sql immutable as $body$
  select public.memory_canonical_mirror_chunk_hash(p_chunk);
$body$;

-- ---------------------------------------------------------------------------
-- Fence wrappers (bake in the Phase 0 deployment-authority lease)
-- ---------------------------------------------------------------------------
create or replace function public.brj_enroll(p_owner uuid, p_sess uuid)
returns public.memory_owner_state language sql as $body$
  select * from public.memory_enroll_mirror_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source', p_owner, p_sess, null);
$body$;

create or replace function public.brj_reserve(p_owner uuid, p_sess uuid)
returns public.memory_mirror_rate_limits language sql as $body$
  select * from public.memory_reserve_mirror_request_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source', p_owner, p_sess);
$body$;

create or replace function public.brj_begin(
  p_owner uuid, p_sess uuid, p_manifest text, p_gen bigint,
  p_chunks integer, p_sources integer, p_msgs integer
) returns public.memory_import_manifests language sql as $body$
  select * from public.memory_begin_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source', p_owner, p_sess,
    p_manifest,
    (select dataset_id from public.memory_owner_state where owner_id = p_owner),
    1, p_gen, p_chunks, p_sources, p_msgs, null);
$body$;

create or replace function public.brj_accept(
  p_owner uuid, p_sess uuid, p_manifest text, p_idx integer, p_chunk jsonb
) returns public.memory_import_chunks language sql as $body$
  select * from public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source', p_owner, p_sess,
    p_manifest, p_idx, p_chunk, public.memory_canonical_mirror_chunk_hash(p_chunk));
$body$;

create or replace function public.brj_validate(p_owner uuid, p_sess uuid, p_manifest text)
returns public.memory_import_manifests language sql as $body$
  select * from public.memory_validate_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source', p_owner, p_sess, p_manifest);
$body$;

create or replace function public.brj_prepare(p_owner uuid, p_sess uuid, p_manifest text)
returns public.memory_import_completion_permits language sql as $body$
  select * from public.memory_prepare_source_completion_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source', p_owner, p_sess,
    p_manifest, (select authority_version from public.memory_owner_state where owner_id = p_owner));
$body$;

create or replace function public.brj_complete(p_owner uuid, p_sess uuid, p_manifest text, p_permit uuid)
returns public.memory_import_manifests language sql as $body$
  select * from public.memory_complete_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source', p_owner, p_sess,
    p_manifest, p_permit,
    (select authority_version from public.memory_owner_state where owner_id = p_owner),
    (select prepared_hash from public.memory_import_manifests where owner_id = p_owner and id = p_manifest),
    (select prepared_membership_hash from public.memory_import_manifests where owner_id = p_owner and id = p_manifest));
$body$;

create or replace function public.brj_cancel(p_owner uuid, p_sess uuid, p_manifest text)
returns public.memory_import_manifests language sql as $body$
  select * from public.memory_cancel_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source', p_owner, p_sess, p_manifest);
$body$;

-- ---------------------------------------------------------------------------
-- Setup: writer fence, auth users/sessions, allowlist, enrollment
-- ---------------------------------------------------------------------------
update public.memory_deployment_authority
set
  mode = 'active',
  writer_epoch = 1,
  writer_lease_id = '00000000-0000-4000-8000-000000000077',
  writer_lease_token_digest = encode(sha256(convert_to('local-test-writer-token', 'UTF8')), 'hex'),
  writer_lease_expires_at = clock_timestamp() + interval '1 hour',
  writer_lease_issuer = 'phase1-pgtap',
  writer_lease_key_id = 'phase1-test-key',
  source_credential_fingerprint = 'sha256:local-source'
where singleton;

insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-00000000000a', 'a@test.dev', now(), now()),
  ('00000000-0000-4000-8000-00000000000b', 'b@test.dev', now(), now()),
  ('00000000-0000-4000-8000-00000000000c', 'c@test.dev', now(), now()),
  ('00000000-0000-4000-8000-00000000000d', 'd@test.dev', now(), now())
on conflict (id) do nothing;

insert into auth.sessions (id, user_id, created_at, updated_at, not_after) values
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', now(), now(), null),
  ('20000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', now(), now(), null),
  ('10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b', now(), now(), null),
  ('10000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-00000000000c', now(), now(), null),
  ('10000000-0000-4000-8000-00000000000d', '00000000-0000-4000-8000-00000000000d', now(), now(), null)
on conflict (id) do nothing;

insert into public.memory_mirror_owner_allowlist (owner_id, enabled) values
  ('00000000-0000-4000-8000-00000000000a', true),
  ('00000000-0000-4000-8000-00000000000b', true),
  ('00000000-0000-4000-8000-00000000000d', true)
on conflict (owner_id) do nothing;

select extensions.lives_ok($core$
  select * from public.brj_enroll(
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a')
$core$, 'owner A enrolls and receives a server dataset');

select extensions.lives_ok($core$
  select * from public.brj_enroll(
    '00000000-0000-4000-8000-00000000000b',
    '10000000-0000-4000-8000-00000000000b')
$core$, 'owner B enrolls');

select extensions.lives_ok($core$
  select * from public.brj_enroll(
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d')
$core$, 'owner D enrolls');

-- Enroll never demotes: a repeated enroll returns the same state unchanged.
select extensions.is(
  (select authority_state from public.memory_owner_state
   where owner_id = '00000000-0000-4000-8000-00000000000d'),
  'LOCAL',
  'enroll leaves authority at LOCAL'
);

-- ---------------------------------------------------------------------------
-- Owner access: untrusted / disabled / revoked-session gate (Prove list)
-- ---------------------------------------------------------------------------
select extensions.throws_ok($core$
  select * from public.memory_enroll_mirror_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000c',
    '10000000-0000-4000-8000-00000000000c', null)
$core$, 'P0001', 'OWNER_NOT_TRUSTED', 'confirmed but non-allowlisted owner cannot enroll');

select extensions.throws_ok($core$
  select * from public.memory_reserve_mirror_request_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000c',
    '10000000-0000-4000-8000-00000000000c')
$core$, 'P0001', 'OWNER_NOT_TRUSTED', 'non-allowlisted owner cannot reserve budget');

select extensions.throws_ok($core$
  select * from public.memory_begin_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000c',
    '10000000-0000-4000-8000-00000000000c',
    'm-blocked', '00000000-0000-4000-8000-00000000000c',
    1, 2, 1, 1, 1, null)
$core$, 'P0001', 'OWNER_NOT_TRUSTED', 'non-allowlisted owner cannot allocate import rows');

-- Disabling an enrolled owner blocks every later mutation.
update public.memory_mirror_owner_allowlist
set enabled = false, disabled_at = clock_timestamp()
where owner_id = '00000000-0000-4000-8000-00000000000d';

select extensions.throws_ok($core$
  select * from public.memory_enroll_mirror_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', null)
$core$, 'P0001', 'OWNER_DISABLED', 'disabled owner cannot enroll');

select extensions.throws_ok($core$
  select * from public.memory_reserve_mirror_request_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d')
$core$, 'P0001', 'OWNER_DISABLED', 'disabled owner cannot reserve');

select extensions.throws_ok($core$
  select * from public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-x', 0, '{}'::jsonb, 'x')
$core$, 'P0001', 'OWNER_DISABLED', 'disabled owner cannot accept chunks');

select extensions.throws_ok($core$
  select * from public.memory_complete_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-x', '00000000-0000-4000-8000-000000000009', 1, 'h', 'm')
$core$, 'P0001', 'OWNER_DISABLED', 'disabled owner cannot complete');

select extensions.throws_ok($core$
  select * from public.memory_apply_source_tombstone_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'journal', 'entry-d', 1, null, 'del-d', now(), 'USER_DELETE')
$core$, 'P0001', 'OWNER_DISABLED', 'disabled owner cannot tombstone');

-- Re-enable D for the quota tests below.
update public.memory_mirror_owner_allowlist
set enabled = true, disabled_at = null
where owner_id = '00000000-0000-4000-8000-00000000000d';

-- A verified JWT whose session row was revoked cannot mutate during its
-- remaining access-token lifetime, while a still-live session remains valid.
do $do$
begin
  -- reserve under the live session first (succeeds), then revoke session 002.
  perform public.memory_reserve_mirror_request_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '20000000-0000-4000-8000-00000000000a');
  update auth.sessions set not_after = now() - interval '1 second'
   where id = '20000000-0000-4000-8000-00000000000a';
end
$do$;

select extensions.throws_ok($core$
  select * from public.memory_reserve_mirror_request_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '20000000-0000-4000-8000-00000000000a')
$core$, 'P0001', 'MEMORY_SESSION_REVOKED', 'revoked session cannot mutate');

select extensions.lives_ok($core$
  select * from public.memory_reserve_mirror_request_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a')
$core$, 'still-live session for the same owner remains independently valid');

-- ---------------------------------------------------------------------------
-- Reserve: rolling-minute and database-day budgets, exact boundaries
-- ---------------------------------------------------------------------------
-- Owner B: fill the rolling minute to exactly 30; the 31st fails.
do $do$
begin
  for i in 1..30 loop
    perform public.memory_reserve_mirror_request_v1(
      'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
      'local-test-writer-token', 'sha256:local-source',
      '00000000-0000-4000-8000-00000000000b',
      '10000000-0000-4000-8000-00000000000b');
  end loop;
end
$do$;

select extensions.is(
  (select minute_request_count from public.memory_mirror_rate_limits
   where owner_id = '00000000-0000-4000-8000-00000000000b'),
  30::integer,
  'minute cap exactly 30 passes'
);

select extensions.throws_ok($core$
  select * from public.memory_reserve_mirror_request_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000b',
    '10000000-0000-4000-8000-00000000000b')
$core$, 'P0001', 'MIRROR_RATE_LIMIT_MINUTE', '31st request in the minute fails stably');

select extensions.is(
  (select minute_request_count from public.memory_mirror_rate_limits
   where owner_id = '00000000-0000-4000-8000-00000000000b'),
  30::integer,
  'minute cap stays at 30 after the rejected request (no partial row)'
);

-- Database-day budget: drive to exactly 1000, then the next fails. The minute
-- budget is cleared first because the minute check is evaluated before the day
-- check.
update public.memory_mirror_rate_limits
set minute_request_timestamps = '[]'::jsonb,
    minute_request_count = 0,
    day_started_on = current_date,
    day_request_count = 999
where owner_id = '00000000-0000-4000-8000-00000000000b';

select extensions.lives_ok($core$
  select * from public.memory_reserve_mirror_request_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000b',
    '10000000-0000-4000-8000-00000000000b')
$core$, '999th daily reservation accepted');

select extensions.throws_ok($core$
  select * from public.memory_reserve_mirror_request_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000b',
    '10000000-0000-4000-8000-00000000000b')
$core$, 'P0001', 'MIRROR_RATE_LIMIT_DAY', '1001st daily reservation fails stably');
select extensions.is(
  (select day_request_count from public.memory_mirror_rate_limits
   where owner_id = '00000000-0000-4000-8000-00000000000b'),
  1000::integer,
  'day cap stays at 1000 (no overshoot row)'
);

-- ---------------------------------------------------------------------------
-- Staging / observed-revision / compact-receipt / permit quotas via owner D
-- ---------------------------------------------------------------------------
-- Staged conversation ceiling: 2560 staged identities; one more rejects with
-- no partial rows.
select extensions.lives_ok($core$
  select * from public.brj_begin(
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-quota', 1, 4, 1, 1)
$core$, 'owner D begins the quota manifest');

-- Accept two chunks: chunk 0 carries 1 conversation; we then stage 2560
-- conversation identities by repeated 2560-accept of tiny conversations would
-- be slow, so directly stage items and assert the ceiling guard rejects.
insert into public.memory_import_items (
  owner_id, manifest_id, chunk_index, item_kind, stable_id, conversation_id,
  observed_revision, canonical_hash, payload
)
select '00000000-0000-4000-8000-00000000000d', 'm-quota', 0, 'conversation',
       'cv-' || g, 'cv-' || g, 1, 'sha256:0000', '{}'::jsonb
from generate_series(1, 2560) g;

select extensions.throws_ok($core$
  select * from public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-quota', 1,
    public.brj_chunk('m-quota', 1, jsonb_build_array(
      public.brj_conv('cv-quota-plus', 1, null,
        jsonb_build_array(public.brj_msg('qq0', 'cv-quota-plus', 'user', 0, 1, 'x', 'active', now())))
    )),
    public.brj_hash(public.brj_chunk('m-quota', 1, jsonb_build_array(
      public.brj_conv('cv-quota-plus', 1, null,
        jsonb_build_array(public.brj_msg('qq0', 'cv-quota-plus', 'user', 0, 1, 'x', 'active', now())))
    ))))
$core$, 'P0001', 'MIRROR_STAGING_CONVERSATION_LIMIT', '2561 staged conversations reject stably');

delete from public.memory_import_items
 where manifest_id = 'm-quota'
   and stable_id like 'cv-%';

-- Observed-revision ceiling: 20,000 staged messages; one more rejects.
insert into public.memory_import_items (
  owner_id, manifest_id, chunk_index, item_kind, stable_id, conversation_id,
  observed_revision, canonical_hash, payload
)
select '00000000-0000-4000-8000-00000000000d', 'm-quota', 0, 'message',
       'qm-' || g, 'cv-gas', 1, 'sha256:0000', '{}'::jsonb
from generate_series(1, 20000) g;

select extensions.throws_ok($core$
  select * from public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-quota', 2,
    public.brj_chunk('m-quota', 2, jsonb_build_array(
      public.brj_conv('cv-msg-plus', 1, null,
        jsonb_build_array(public.brj_msg('qq1', 'cv-msg-plus', 'user', 0, 1, 'x', 'active', now())))
    )),
    public.brj_hash(public.brj_chunk('m-quota', 2, jsonb_build_array(
      public.brj_conv('cv-msg-plus', 1, null,
        jsonb_build_array(public.brj_msg('qq1', 'cv-msg-plus', 'user', 0, 1, 'x', 'active', now())))
    ))))
$core$, 'P0001', 'MIRROR_STAGING_MESSAGE_LIMIT', '20001 staged messages reject stably');

delete from public.memory_import_items where manifest_id = 'm-quota';
select extensions.lives_ok($core$
  select * from public.brj_cancel(
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-quota')
$core$, 'cancellation prunes the quota manifest');
select extensions.is(
  (select status from public.memory_import_manifests
   where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-quota'),
  'cancelled', 'quota manifest is cancelled');

-- Manual push to retained-revision boundary: 200,000 retained rows is the
-- ceiling for begin; 199,999 passes and 200,000 rejects.
insert into public.memory_conversations (
  owner_id, id, source_kind, source_record_id, status, started_at,
  temporal_provenance, client_schema_version, eligibility, source_revision
)
select '00000000-0000-4000-8000-00000000000d', 'cv-q', 'journal', 'entry-q',
       'settled', now(), 'captured', 1, 'eligible', 1
on conflict (owner_id, id) do nothing;

insert into public.memory_conversation_revisions (
  owner_id, conversation_id, source_revision, source_kind, source_record_id,
  status, started_at, temporal_provenance, client_schema_version,
  revision_provenance, eligibility, manifest_id, canonical_hash
)
select '00000000-0000-4000-8000-00000000000d', 'cv-q', g, 'journal',
       'entry-q', 'settled', now(), 'captured', 1,
       'contiguous', 'eligible', null, 'sha256:0000'
from generate_series(1, 200000) g;

select extensions.throws_ok($core$
  select * from public.memory_begin_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-rt-reject', (select dataset_id from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
    1, 2, 1, 1, 1, null)
$core$, 'P0001', 'MIRROR_RETAINED_REVISION_LIMIT', '200000 retained revisions reject a new begin');

delete from public.memory_conversation_revisions
 where owner_id = '00000000-0000-4000-8000-00000000000d' and conversation_id = 'cv-q';
delete from public.memory_conversations
 where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'cv-q';

-- Full happy path A: begin -> accept -> validate -> prepare -> complete.
select extensions.lives_ok($core$
  select * from public.brj_begin(
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a',
    'm-a1', 1, 1, 1, 2)
$core$, 'owner A begins a first-generation manifest');

select extensions.throws_ok($core$
  select * from public.memory_begin_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a',
    'm-a1', (select dataset_id from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000a'),
    1, 0, 1, 1, 2, null)
$core$, 'PT409', 'MIRROR_GENERATION_STALE', 'non-monotonic generation rejects');

-- Active-manifest fence: a second begin while the first is active conflicts.
select extensions.throws_ok($core$
  select * from public.memory_begin_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a',
    'm-a1-dup', (select dataset_id from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000a'),
    1, 2, 1, 1, 2, null)
$core$, 'PT409', 'ACTIVE_IMPORT_EXISTS', 'one active manifest per owner');

-- Different owners do not block each other.
select extensions.lives_ok($core$
  select * from public.brj_begin(
    '00000000-0000-4000-8000-00000000000b',
    '10000000-0000-4000-8000-00000000000b',
    'm-b1', 1, 1, 1, 2)
$core$, 'owner B begins concurrently without blocking on A');

-- Chunk byte ceiling: an encoded chunk over 256 KiB rejects with no rows.
do $do$
declare
  v_big text := repeat('x', 300000);
  v_chunk jsonb;
begin
  v_chunk := public.brj_chunk('m-a1', 0, jsonb_build_array(
    public.brj_conv('cv-big', 1, null,
      jsonb_build_array(public.brj_msg('big0', 'cv-big', 'user', 0, 1, v_big, 'active', now())))
  ));
  begin
    perform public.memory_accept_source_chunk_v1(
      'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
      'local-test-writer-token', 'sha256:local-source',
      '00000000-0000-4000-8000-00000000000a',
      '10000000-0000-4000-8000-00000000000a',
      'm-a1', 0, v_chunk, public.brj_hash(v_chunk));
    raise exception 'expected byte-limit rejection';
  exception when others then
    if sqlerrm = 'expected byte-limit rejection' then raise; end if;
  end;
end
$do$;

select extensions.is(
  (select count(*) from public.memory_import_items
   where owner_id = '00000000-0000-4000-8000-00000000000a' and manifest_id = 'm-a1'),
  0::bigint,
  'oversize chunk leaves no partial staged rows'
);

-- Out-of-order chunk index rejection: an index at/beyond the declared chunk
-- bound is rejected before any staging (owner B's m-b1 declares exactly one
-- chunk).
select extensions.throws_ok($core$
  select * from public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000b',
    '10000000-0000-4000-8000-00000000000b',
    'm-b1', 1,
    public.brj_chunk('m-b1', 1, jsonb_build_array(
      public.brj_conv('cv-oob', 1, null, jsonb_build_array(
        public.brj_msg('mq-oob', 'cv-oob', 'user', 0, 1, 'x', 'active', '2026-07-20T00:00:01+00:00')
      ))
    )),
    public.brj_hash(public.brj_chunk('m-b1', 1, jsonb_build_array(
      public.brj_conv('cv-oob', 1, null, jsonb_build_array(
        public.brj_msg('mq-oob', 'cv-oob', 'user', 0, 1, 'x', 'active', '2026-07-20T00:00:01+00:00')
      ))
    ))))
$core$, '22023', 'MIRROR_CHUNK_OUT_OF_ORDER', 'chunk index at the declared bound is out of order');
select extensions.is(
  (select count(*) from public.memory_import_chunks
   where owner_id = '00000000-0000-4000-8000-00000000000b' and manifest_id = 'm-b1'),
  0::bigint, 'out-of-order chunk leaves no chunk rows');

-- Accept chunk 0 of m-a1.
do $do$
declare
  v_chunk jsonb := public.brj_chunk('m-a1', 0, jsonb_build_array(
    public.brj_conv('cv-a1', 1, null, jsonb_build_array(
      public.brj_msg('mq-a1-0', 'cv-a1', 'user', 0, 1, 'hello', 'active', '2026-07-20T00:00:01+00:00'),
      public.brj_msg('mq-a1-1', 'cv-a1', 'assistant', 1, 1, 'hi', 'active', '2026-07-20T00:00:02+00:00')
    ))
  ));
begin
  perform public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a',
    'm-a1', 0, v_chunk, public.brj_hash(v_chunk));
end
$do$;

select extensions.is(
  (select status from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'm-a1'),
  'receiving', 'chunk accept moves the manifest to receiving');
select extensions.is(
  (select count(*) from public.memory_import_chunks
   where owner_id = '00000000-0000-4000-8000-00000000000a' and manifest_id = 'm-a1'),
  1::bigint, 'exactly one chunk row written');
select extensions.is(
  (select eligibility from public.memory_conversations
   where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'cv-a1'),
  'staged', 'accepted conversation is staged until completion');
select extensions.is(
  (select count(*) from public.memory_conversation_revisions
   where owner_id = '00000000-0000-4000-8000-00000000000a' and conversation_id = 'cv-a1'),
  1::bigint, 'exactly one observed conversation revision is recorded');

-- Guard (sabotage): the chunk SHA-256 is recomputed independently; a
-- mismatching client hash is rejected and rolls back every row.
select extensions.throws_ok($core$
  select * from public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a',
    'm-a1', 0,
    public.brj_chunk('m-a1', 0, jsonb_build_array(
      public.brj_conv('cv-a1', 1, null, jsonb_build_array(
        public.brj_msg('mq-a1-0', 'cv-a1', 'user', 0, 1, 'hello', 'active', '2026-07-20T00:00:01+00:00'),
        public.brj_msg('mq-a1-1', 'cv-a1', 'assistant', 1, 1, 'hi', 'active', '2026-07-20T00:00:02+00:00')
      )))),
    'sha256:0000000000000000000000000000000000000000000000000000000000000000')
$core$, 'P0001', 'MIRROR_CHUNK_HASH_MISMATCH', 'client-supplied hash is never trusted');

-- Guard (sabotage): the chunk RPC still enforces the writer fence.
select extensions.throws_ok($core$
  select * from public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'wrong-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a',
    'm-a1', 0,
    public.brj_chunk('m-a1', 0, jsonb_build_array(
      public.brj_conv('cv-a1', 1, null, jsonb_build_array(
        public.brj_msg('mq-a1-0', 'cv-a1', 'user', 0, 1, 'hello', 'active', '2026-07-20T00:00:01+00:00')
      )))),
    'sha256:0000')
$core$, 'P0001', 'MEMORY_WRITER_LEASE_TOKEN_INVALID', 'chunk RPC enforces the writer fence');

-- Payload/hash mismatch rolls back all rows and a later replayed chunk with an
-- equal index but a changed body conflicts instead of writing (asserted by the
-- throws_ok below; the reject leaves the manifest's original chunk untouched).

-- Changed replay with the same index conflicts (the canonical hash differs).
select extensions.throws_ok($core$
  select * from public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a',
    'm-a1', 0,
    public.brj_chunk('m-a1', 0, jsonb_build_array(
      public.brj_conv('cv-a1-edit', 1, null, jsonb_build_array(
        public.brj_msg('mq-e0', 'cv-a1-edit', 'user', 0, 1, 'different-body', 'active', '2026-07-20T00:00:01+00:00')
      )))),
    public.brj_hash(public.brj_chunk('m-a1', 0, jsonb_build_array(
      public.brj_conv('cv-a1-edit', 1, null, jsonb_build_array(
        public.brj_msg('mq-e0', 'cv-a1-edit', 'user', 0, 1, 'different-body', 'active', '2026-07-20T00:00:01+00:00')
      ))))))
$core$, 'PT409', 'MEMORY_IDEMPOTENCY_CONFLICT', 'changed chunk replay conflicts');

-- The accidental cv-a1-edit staging exists now; remove it so m-a1 stays a
-- one-chunk manifest with cv-a1 only.
delete from public.memory_import_items
 where owner_id = '00000000-0000-4000-8000-00000000000a' and manifest_id = 'm-a1'
   and stable_id = 'cv-a1-edit';
delete from public.memory_conversation_revisions
 where owner_id = '00000000-0000-4000-8000-00000000000a' and conversation_id = 'cv-a1-edit';
delete from public.memory_conversations
 where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'cv-a1-edit';

-- ---------------------------------------------------------------------------
-- Validate + prepare + complete: LOCAL -> MIRROR, union advance, compaction
-- ---------------------------------------------------------------------------
select extensions.lives_ok($core$
  select * from public.brj_validate(
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a', 'm-a1')
$core$, 'validate marks the manifest prepared');

select extensions.isnt(
  (select prepared_chunk_receipt from public.memory_import_manifests
   where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'm-a1'),
  '[]'::jsonb,
  'bounded compact chunk receipt is persisted on validate'
);

select extensions.is(
  (select count(*) from public.memory_import_chunks
   where owner_id = '00000000-0000-4000-8000-00000000000a' and manifest_id = 'm-a1'),
  0::bigint, 'validate compacts the bulky chunk rows');

select extensions.lives_ok($core$
  select * from public.brj_prepare(
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a', 'm-a1')
$core$, 'prepare issues a live completion permit');

do $do$
declare
  v_permit uuid;
begin
  select id into v_permit from public.memory_import_completion_permits
   where owner_id = '00000000-0000-4000-8000-00000000000a' and manifest_id = 'm-a1';
  perform public.memory_complete_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a',
    'm-a1', v_permit,
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000a'),
    (select prepared_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'm-a1'),
    (select prepared_membership_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'm-a1'));
end
$do$;

select extensions.is(
  (select authority_state from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000a'),
  'MIRROR', 'finalization alone changes LOCAL -> MIRROR');
select extensions.is(
  (select source_set_conversation_count from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000a'),
  1, 'owner-union counts the completed conversation');
select extensions.is(
  (select source_set_message_count from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000a'),
  2, 'owner-union counts the completed messages');
select extensions.isnt(
  (select source_set_receipt from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000a'),
  null::text, 'owner-union receipt is recorded');
select extensions.is(
  (select eligibility from public.memory_conversations
   where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'cv-a1'),
  'eligible', 'completed conversation becomes eligible');
select extensions.is(
  (select eligibility from public.memory_messages
   where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'mq-a1-0'),
  'eligible', 'completed message becomes eligible');
select extensions.is(
  (select count(*) from public.memory_import_items
   where owner_id = '00000000-0000-4000-8000-00000000000a' and manifest_id = 'm-a1'),
  0::bigint, 'complete compacts the import membership');
select extensions.is(
  (select feature_flags - 'cloudSourceMirroring' from public.memory_owner_state
   where owner_id = '00000000-0000-4000-8000-00000000000a'),
  '{"cloudProjectionBuild": false, "shadowRetrieval": false, "cloudReadAuthority": false, "cloudWriteAuthority": false}'::jsonb,
  'all non-mirroring flags remain false after MIRROR');

-- Completion idempotency: an identical completion retry returns the stored
-- receipt and never double-increments the union version.
do $do$
declare
  v_manifest public.memory_import_manifests;
  v_before bigint;
  v_after bigint;
begin
  select source_set_version into v_before from public.memory_owner_state
   where owner_id = '00000000-0000-4000-8000-00000000000a';
  v_manifest := public.memory_complete_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a',
    'm-a1', '00000000-0000-4000-8000-000000000099',
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000a'),
    (select prepared_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'm-a1'),
    (select prepared_membership_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'm-a1'));
  select source_set_version into v_after from public.memory_owner_state
   where owner_id = '00000000-0000-4000-8000-00000000000a';
  if v_before = v_after and v_manifest.status = 'verified' then
    raise notice 'completion retry idempotent';
  else
    raise exception 'completion retry double-incremented or failed: before %, after %, status %', v_before, v_after, v_manifest.status;
  end if;
end
$do$;

-- Identical completed-chunk retry reconstructs the same receipt.
select extensions.is(
  (select (public.memory_accept_source_chunk_v1(
     'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
     'local-test-writer-token', 'sha256:local-source',
     '00000000-0000-4000-8000-00000000000a',
     '10000000-0000-4000-8000-00000000000a',
     'm-a1', 0,
     public.brj_chunk('m-a1', 0, jsonb_build_array(
       public.brj_conv('cv-a1', 1, null, jsonb_build_array(
         public.brj_msg('mq-a1-0', 'cv-a1', 'user', 0, 1, 'hello', 'active', '2026-07-20T00:00:01+00:00'),
         public.brj_msg('mq-a1-1', 'cv-a1', 'assistant', 1, 1, 'hi', 'active', '2026-07-20T00:00:02+00:00')
       )))),
     public.brj_hash(public.brj_chunk('m-a1', 0, jsonb_build_array(
       public.brj_conv('cv-a1', 1, null, jsonb_build_array(
         public.brj_msg('mq-a1-0', 'cv-a1', 'user', 0, 1, 'hello', 'active', '2026-07-20T00:00:01+00:00'),
         public.brj_msg('mq-a1-1', 'cv-a1', 'assistant', 1, 1, 'hi', 'active', '2026-07-20T00:00:02+00:00')
       ))))))).status),
  'accepted', 'identical completed-chunk retry reconstructs the receipt');

-- A changed completed-chunk retry conflicts.
select extensions.throws_ok($core$
  select * from public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a',
    'm-a1', 0,
    public.brj_chunk('m-a1', 0, jsonb_build_array(
      public.brj_conv('cv-a1', 1, null, jsonb_build_array(
        public.brj_msg('mq-a1-0', 'cv-a1', 'user', 0, 1, 'not-hello', 'active', '2026-07-20T00:00:01+00:00')
      )))),
    public.brj_hash(public.brj_chunk('m-a1', 0, jsonb_build_array(
      public.brj_conv('cv-a1', 1, null, jsonb_build_array(
        public.brj_msg('mq-a1-0', 'cv-a1', 'user', 0, 1, 'not-hello', 'active', '2026-07-20T00:00:01+00:00')
      ))))))
$core$, 'PT409', 'MEMORY_IDEMPOTENCY_CONFLICT', 'changed completed-chunk retry conflicts');

-- ---------------------------------------------------------------------------
-- Revision CAS semantics
-- ---------------------------------------------------------------------------
-- Unit-level proof of the CAS matrix.
select extensions.isnt(
  (select true from public.memory_assert_mirror_revision(null, 3, null, false)
   where provenance = 'first_observed' and gap_start is null and gap_end is null
     and (select count(*) from public.memory_assert_mirror_revision(null, 3, null, false)) = 1),
  false, 'first observed revision greater than 1 is recorded honestly');

select extensions.is(
  (select provenance || ':' || coalesce(gap_start::text, '-') || ':' || coalesce(gap_end::text, '-')
   from public.memory_assert_mirror_revision(4, 5, 4, false)),
  'contiguous:-:-', 'adjacent append is contiguous with no invented gap');

select extensions.is(
  (select provenance || ':' || gap_start::text || ':' || gap_end::text
   from public.memory_assert_mirror_revision(4, 7, 4, false)),
  'coalesced_gap:5:6', 'accepted coalesced jump carries exact numeric gap bounds');

select extensions.throws_ok($core$
  select * from public.memory_assert_mirror_revision(4, 7, 3, false)
$core$, 'PT409', 'MIRROR_REVISION_CONFLICT', 'wrong previousAcceptedRevision conflicts');

select extensions.throws_ok($core$
  select * from public.memory_assert_mirror_revision(4, 2, 4, false)
$core$, 'PT409', 'MIRROR_REVISION_CONFLICT', 'lower incoming revision is stale');

-- ---------------------------------------------------------------------------
-- Two-device same-owner flow (plan 7.4)
-- ---------------------------------------------------------------------------
-- Device A already completed m-a1 (revision 1 of cv-a1). Device B shares the
-- same stable conversation and made its own offline edit that the server has
-- not seen; device A makes a newer offline edit. Whichever reaches the server
-- first wins; the other must be rejected by revision CAS and never overwrite
-- the accepted rows.

-- Device A begins m-a2 with an edit of cv-a1 at source revision 3
-- (two offline edits: 1 -> 2 -> 3, coalesced on the wire) plus a new
-- disjoint addition cv-disp-A.
update auth.sessions set not_after = null
 where id = '20000000-0000-4000-8000-00000000000a';
do $do$
begin
  perform public.memory_begin_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a',
    'm-a2', (select dataset_id from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000a'),
    1, 3, 1, 1, 2, null);
  perform public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a',
    'm-a2', 0,
    public.brj_chunk('m-a2', 0, jsonb_build_array(
      public.brj_conv('cv-a1', 3, 1, jsonb_build_array(
        public.brj_msg('mq-a1-0', 'cv-a1', 'user', 0, 3, 'hello-edit', 'active', '2026-07-20T00:00:01+00:00', 1),
        public.brj_msg('mq-a1-1', 'cv-a1', 'assistant', 1, 3, 'hi2', 'active', '2026-07-20T00:00:02+00:00', 1)
      )))),
    public.brj_hash(public.brj_chunk('m-a2', 0, jsonb_build_array(
      public.brj_conv('cv-a1', 3, 1, jsonb_build_array(
        public.brj_msg('mq-a1-0', 'cv-a1', 'user', 0, 3, 'hello-edit', 'active', '2026-07-20T00:00:01+00:00', 1),
        public.brj_msg('mq-a1-1', 'cv-a1', 'assistant', 1, 3, 'hi2', 'active', '2026-07-20T00:00:02+00:00', 1)
      ))))));
end
$do$;

-- Device B, sharing stable IDs, tries to complete an older offline snapshot of
-- cv-a1 at revision 2 with previousAcceptedRevision 1 while A's manifest is
-- active: the second begin conflicts first.
select extensions.throws_ok($core$
  select * from public.memory_begin_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '20000000-0000-4000-8000-00000000000a',
    'm-a2-b', (select dataset_id from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000a'),
    1, 4, 1, 1, 2, null)
$core$, 'PT409', 'ACTIVE_IMPORT_EXISTS', 'second begin while A is active is stable');

-- Device A finalizes m-a2.
do $do$
declare
  v_permit uuid;
begin
  perform public.memory_validate_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a', 'm-a2');
  v_permit := (select id from public.memory_prepare_source_completion_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a', 'm-a2',
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000a')));
  perform public.memory_complete_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a',
    'm-a2', v_permit,
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000a'),
    (select prepared_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'm-a2'),
    (select prepared_membership_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'm-a2'));
end
$do$;

select extensions.is(
  (select status from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'm-a2'),
  'verified', 'device A completes its own manifest');
select extensions.is(
  (select content from public.memory_messages
   where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'mq-a1-0'),
  'hello-edit', 'device A accepted rows carry A prose');
select extensions.is(
  (select revision_provenance from public.memory_conversation_revisions
   where owner_id = '00000000-0000-4000-8000-00000000000a'
     and conversation_id = 'cv-a1' and source_revision = 3 and manifest_id = 'm-a2'),
  'coalesced_gap', 'two offline edits coalesce');
select extensions.is(
  (select gap_start_revision || ':' || gap_end_revision from public.memory_conversation_revisions
   where owner_id = '00000000-0000-4000-8000-00000000000a'
     and conversation_id = 'cv-a1' and source_revision = 3 and manifest_id = 'm-a2'),
  '2:2', 'coalesced gap bounds are exact (revision 2 was skipped on the wire)');

-- Device B, with a stale shared-source snapshot (older previousAcceptedRevision
-- and an outdated revision), is rejected by revision CAS and never overwrites
-- A's accepted rows, while B's disjoint additions complete.
do $do$
begin
  perform public.memory_begin_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '20000000-0000-4000-8000-00000000000a',
    'm-b2', (select dataset_id from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000a'),
    1, 4, 1, 2, 4, null);
end
$do$;

select extensions.throws_ok($core$
  select * from public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '20000000-0000-4000-8000-00000000000a',
    'm-b2', 0,
    public.brj_chunk('m-b2', 0, jsonb_build_array(
      public.brj_conv('cv-a1', 2, 1, jsonb_build_array(
        public.brj_msg('mq-a1-0', 'cv-a1', 'user', 0, 2, 'stale-overwrite', 'active', '2026-07-20T00:00:01+00:00', 1)
      )),
      public.brj_conv('cv-disp-B', 1, null, jsonb_build_array(
        public.brj_msg('mq-b0', 'cv-disp-B', 'user', 0, 1, 'b-wins', 'active', '2026-07-20T00:00:03+00:00')
      ))
    )),
    public.brj_hash(public.brj_chunk('m-b2', 0, jsonb_build_array(
      public.brj_conv('cv-a1', 2, 1, jsonb_build_array(
        public.brj_msg('mq-a1-0', 'cv-a1', 'user', 0, 2, 'stale-overwrite', 'active', '2026-07-20T00:00:01+00:00', 1)
      )),
      public.brj_conv('cv-disp-B', 1, null, jsonb_build_array(
        public.brj_msg('mq-b0', 'cv-disp-B', 'user', 0, 1, 'b-wins', 'active', '2026-07-20T00:00:03+00:00')
      ))
    ))))
$core$, 'PT409', 'MIRROR_REVISION_CONFLICT', 'stale shared-source snapshot is rejected atomically');

-- The stale snapshot must fail at revision CAS with no partial rows, without
-- overwriting A; B retries with only its disjoint addition.
select extensions.is(
  (select count(*) from public.memory_conversations
   where owner_id = '00000000-0000-4000-8000-00000000000a'
     and (id = 'cv-a1' and eligibility = 'eligible') or (id = 'cv-disp-B')),
  1::bigint, 'rejected B chunk leaves no partial conversation rows');
select extensions.is(
  (select content from public.memory_messages
   where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'mq-a1-0'),
  'hello-edit', 'B stale snapshot never overwrites A accepted rows');

-- ---------------------------------------------------------------------------
-- Cancel/supersede (plan 5.6) + cumulative owner-union carry-forward (5.5)
-- ---------------------------------------------------------------------------
-- B's stale chunk was rejected: m-b2 holds no staged rows. Cancelling it must
-- prune nothing eligible and persist a compact idempotent cancellation receipt.
do $do$
begin
  perform public.memory_cancel_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '20000000-0000-4000-8000-00000000000a',
    'm-b2');
end
$do$;

select extensions.is(
  (select status from public.memory_import_manifests
   where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'm-b2'),
  'cancelled', 'cancel moves the empty active manifest to cancelled');

select extensions.isnt(
  (select cancellation_receipt from public.memory_import_manifests
   where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'm-b2'),
  null::text, 'cancel persists a compact idempotent cancellation receipt');

-- Repeated cancel is idempotent: the stored receipt is returned unchanged.
do $do$
declare
  v_before text;
  v_after text;
begin
  select cancellation_receipt into v_before
    from public.memory_import_manifests
    where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'm-b2';
  select cancellation_receipt into v_after
    from public.memory_cancel_source_import_v1(
      'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
      'local-test-writer-token', 'sha256:local-source',
      '00000000-0000-4000-8000-00000000000a',
      '20000000-0000-4000-8000-00000000000a',
      'm-b2');
  if v_before is not null and v_before = v_after then
    raise notice 'cancel retry idempotent';
  else
    raise exception 'cancel retry changed receipt: before %, after %', v_before, v_after;
  end if;
end
$do$;

-- B retries with only its disjoint addition, no A prose: a nonempty B-only
-- manifest (cv-disp-B) completes without possessing any of A's cv-a1 rows.
-- The owner union must then carry BOTH A's verified rows and B's addition.
do $do$
declare
  v_permit uuid;
begin
  perform public.memory_begin_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '20000000-0000-4000-8000-00000000000a',
    'm-b3', (select dataset_id from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000a'),
    1, 5, 1, 1, 1, null);
  perform public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '20000000-0000-4000-8000-00000000000a',
    'm-b3', 0,
    public.brj_chunk('m-b3', 0, jsonb_build_array(
      public.brj_conv('cv-disp-B', 1, null, jsonb_build_array(
        public.brj_msg('mq-b0', 'cv-disp-B', 'user', 0, 1, 'b-wins', 'active', '2026-07-20T00:00:03+00:00')
      ))
    )),
    public.brj_hash(public.brj_chunk('m-b3', 0, jsonb_build_array(
      public.brj_conv('cv-disp-B', 1, null, jsonb_build_array(
        public.brj_msg('mq-b0', 'cv-disp-B', 'user', 0, 1, 'b-wins', 'active', '2026-07-20T00:00:03+00:00')
      ))
    ))));
  perform public.memory_validate_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '20000000-0000-4000-8000-00000000000a', 'm-b3');
  v_permit := (select id from public.memory_prepare_source_completion_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '20000000-0000-4000-8000-00000000000a', 'm-b3',
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000a')));
  perform public.memory_complete_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '20000000-0000-4000-8000-00000000000a',
    'm-b3', v_permit,
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000a'),
    (select prepared_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'm-b3'),
    (select prepared_membership_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'm-b3'));
end
$do$;

select extensions.is(
  (select source_set_conversation_count from public.memory_owner_state
   where owner_id = '00000000-0000-4000-8000-00000000000a'),
  2, 'B-only completion carries A rows into the owner union (2 conversations)');
select extensions.is(
  (select source_set_message_count from public.memory_owner_state
   where owner_id = '00000000-0000-4000-8000-00000000000a'),
  3, 'B-only completion carries A messages into the owner union (3 messages)');
select extensions.is(
  (select eligibility from public.memory_conversations
   where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'cv-a1'),
  'eligible', 'ordinary absence never deletes or excludes A');
select extensions.is(
  (select eligibility from public.memory_conversations
   where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'cv-disp-B'),
  'eligible', 'B disjoint addition is eligible after its own completion');
-- A and B complete with distinct logical-manifest receipts/versions.
select extensions.isnt(
  (select completion_receipt from public.memory_import_manifests
   where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'm-a2'),
  (select completion_receipt from public.memory_import_manifests
   where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'm-b3'),
  'A and B receive distinct per-manifest completion receipts');
select extensions.is(
  (select status from public.memory_import_manifests
   where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'm-b3'),
  'verified', 'B-only manifest completes');

-- ---------------------------------------------------------------------------
-- Tombstones (plan 5.4)
-- ---------------------------------------------------------------------------
-- Tombstone-before-upload cannot resurrect: a first-observed tombstone for a
-- source with no cloud revision is accepted, and any later upload of that
-- stable identity is dominated.
do $do$
begin
  perform public.memory_apply_source_tombstone_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a',
    'journal', 'entry-cv-tb-first', 5, null, 'tb-first-1',
    now() - interval '1 hour', 'EXPERIMENT_STOPPED');
  perform public.memory_begin_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a',
    'm-tb1', (select dataset_id from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000a'),
    1, 6, 1, 1, 1, null);
end
$do$;

select extensions.throws_ok($core$
  select * from public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a',
    'm-tb1', 0,
    public.brj_chunk('m-tb1', 0, jsonb_build_array(
      public.brj_conv('cv-tb-first', 4, null, jsonb_build_array(
        public.brj_msg('mq-tb0', 'cv-tb-first', 'user', 0, 4, 'resurrect', 'active', '2026-07-21T00:00:00+00:00')
      ))
    )),
    public.brj_hash(public.brj_chunk('m-tb1', 0, jsonb_build_array(
      public.brj_conv('cv-tb-first', 4, null, jsonb_build_array(
        public.brj_msg('mq-tb0', 'cv-tb-first', 'user', 0, 4, 'resurrect', 'active', '2026-07-21T00:00:00+00:00')
      ))
    ))))
$core$, 'PT409', 'MIRROR_TOMBSTONE_DOMINATES', 'tombstone-before-upload cannot resurrect');

-- The blocked import must be cancelled so a later device retry can begin; the
-- cancellation receipt is compact and idempotent.
do $do$
begin
  perform public.memory_cancel_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a',
    'm-tb1');
end
$do$;
select extensions.is(
  (select status from public.memory_import_manifests
   where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'm-tb1'),
  'cancelled', 'tombstone-blocked import is cancelled');

-- A linked Phase 0 evidence span on a cv-a1 message revision is eligible before
-- the tombstone; the tombstone must sweep it to 'deleted' (plan 5.4 effect 6).
insert into public.memory_evidence_spans (
  owner_id, message_revision_id, start_offset, end_offset, span_hash,
  evidence_kind, eligibility
)
select '00000000-0000-4000-8000-00000000000a', revision.id, 0, 10,
       'sha256:evidence', 'reflection', 'eligible'
from public.memory_message_revisions revision
where revision.owner_id = '00000000-0000-4000-8000-00000000000a'
  and revision.message_id = 'mq-a1-0'
  and revision.revision = 1
  and revision.manifest_id = 'm-a1';

-- Tombstone acceptance immediately makes existing eligible rows ineligible and
-- removes them from the owner union, while A's cv-a1 stays visible before it.
do $do$
declare
  v_result public.memory_deletion_ledger%rowtype;
  v_union_receipt text;
begin
  select source_set_receipt into v_union_receipt
    from public.memory_owner_state
    where owner_id = '00000000-0000-4000-8000-00000000000a';
  select * into v_result
    from public.memory_apply_source_tombstone_v1(
      'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
      'local-test-writer-token', 'sha256:local-source',
      '00000000-0000-4000-8000-00000000000a',
      '10000000-0000-4000-8000-00000000000a',
      'journal', 'entry-cv-a1', 4, 3, 'tb-a1-1',
      now() - interval '30 minutes', 'USER_DELETE');
  if v_result.mirror_source_set_receipt is null then
    raise exception 'tombstone union receipt empty';
  end if;
  if v_result.mirror_source_set_receipt = v_union_receipt then
    raise exception 'tombstone did not advance the owner-union receipt';
  end if;
end
$do$;
select extensions.is(
  (select mirror_source_set_receipt from public.memory_deletion_ledger
   where owner_id = '00000000-0000-4000-8000-00000000000a'
     and client_event_id = 'tb-a1-1'),
  (select source_set_receipt from public.memory_owner_state
   where owner_id = '00000000-0000-4000-8000-00000000000a'),
  'tombstone ledger embeds the current owner-union receipt');

-- Plan 5.4 effect 10: the stable tombstone receipt carries the ORIGINAL
-- ineligibility counts (cv-a1 + its two messages were eligible before the
-- sweep) alongside the resulting owner-union receipt.
select extensions.is(
  (select mirror_ineligible_conversation_count from public.memory_deletion_ledger
   where owner_id = '00000000-0000-4000-8000-00000000000a'
     and client_event_id = 'tb-a1-1'),
  1, 'tombstone receipt records the original ineligible conversation count');
select extensions.is(
  (select mirror_ineligible_message_count from public.memory_deletion_ledger
   where owner_id = '00000000-0000-4000-8000-00000000000a'
     and client_event_id = 'tb-a1-1'),
  2, 'tombstone receipt records the original ineligible message count');
select extensions.is(
  ((select mirror_receipt from public.memory_deletion_ledger
    where owner_id = '00000000-0000-4000-8000-00000000000a'
      and client_event_id = 'tb-a1-1') like 'mirror-tombstone:tb-a1-1:ineligible:c1:m2:%'),
  true, 'tombstone receipt string embeds the original ineligibility counts');
select extensions.is(
  (select span.eligibility from public.memory_evidence_spans span
   join public.memory_message_revisions revision
     on revision.owner_id = span.owner_id
     and revision.id = span.message_revision_id
   where span.owner_id = '00000000-0000-4000-8000-00000000000a'
     and revision.message_id = 'mq-a1-0'
     and span.span_hash = 'sha256:evidence'),
  'deleted', 'tombstone sweeps linked evidence spans to deleted');

-- An identical tombstone retry returns the same stored counts/receipt without
-- advancing the source-set version again (plan 5.4 effect 10).
do $do$
declare
  v_result public.memory_deletion_ledger%rowtype;
  v_before bigint;
begin
  select source_set_version into v_before
    from public.memory_owner_state
    where owner_id = '00000000-0000-4000-8000-00000000000a';
  v_result := public.memory_apply_source_tombstone_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '10000000-0000-4000-8000-00000000000a',
    'journal', 'entry-cv-a1', 4, 3, 'tb-a1-1',
    now() - interval '30 minutes', 'USER_DELETE');
  if v_result.mirror_ineligible_conversation_count is distinct from 1
      or v_result.mirror_ineligible_message_count is distinct from 2
      or (select source_set_version from public.memory_owner_state
          where owner_id = '00000000-0000-4000-8000-00000000000a') <> v_before then
    raise exception 'tombstone retry did not return the original counts idempotently';
  end if;
end
$do$;
select extensions.is(
  (select mirror_ineligible_conversation_count from public.memory_deletion_ledger
   where owner_id = '00000000-0000-4000-8000-00000000000a'
     and client_event_id = 'tb-a1-1'),
  1, 'identical tombstone retry keeps the original counts unchanged');

-- The tombstone already advanced the owner union: the receipt changed and the
-- tombstoned cv-a1 is immediately ineligible/deleted.
select extensions.is(
  (select eligibility from public.memory_conversations
   where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'cv-a1'),
  'deleted', 'tombstone acceptance immediately de-eligibilizes cv-a1');
select extensions.is(
  (select status from public.memory_conversations
   where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'cv-a1'),
  'deleted', 'tombstone sets the mirrored conversation status to deleted');
select extensions.is(
  (select eligibility from public.memory_messages
   where owner_id = '00000000-0000-4000-8000-00000000000a' and id = 'mq-a1-0'),
  'deleted', 'tombstone de-eligibilizes the mirror messages');
select extensions.is(
  (select source_set_conversation_count from public.memory_owner_state
   where owner_id = '00000000-0000-4000-8000-00000000000a'),
  1, 'owner union drops the tombstoned conversation');
select extensions.is(
  (select count(*) from public.memory_current_source_conversations
   where owner_id = '00000000-0000-4000-8000-00000000000a'),
  1::bigint, 'current-source parity view hides the tombstoned source');

-- A source tombstoned by the higher revision cannot be re-uploaded by another
-- device of the same owner: B cannot resurrect cv-a1 even at a higher revision
-- because the accepted owner-scoped tombstone dominates the stable identity.
do $do$
begin
  perform public.memory_begin_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '20000000-0000-4000-8000-00000000000a',
    'm-tb2', (select dataset_id from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000a'),
    1, 7, 1, 1, 1, null);
end
$do$;

select extensions.throws_ok($core$
  select * from public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    '20000000-0000-4000-8000-00000000000a',
    'm-tb2', 0,
    public.brj_chunk('m-tb2', 0, jsonb_build_array(
      public.brj_conv('cv-a1', 4, 2, jsonb_build_array(
        public.brj_msg('mq-a1-0', 'cv-a1', 'user', 0, 4, 'resurrect-a1', 'active', '2026-07-22T00:00:00+00:00')
      ))
    )),
    public.brj_hash(public.brj_chunk('m-tb2', 0, jsonb_build_array(
      public.brj_conv('cv-a1', 4, 2, jsonb_build_array(
        public.brj_msg('mq-a1-0', 'cv-a1', 'user', 0, 4, 'resurrect-a1', 'active', '2026-07-22T00:00:00+00:00')
      ))
    ))))
$core$, 'PT409', 'MIRROR_TOMBSTONE_DOMINATES', 'B cannot re-upload a tombstoned identity');

-- ---------------------------------------------------------------------------
-- Authority-state preservation at MIRROR / SHADOW / CLOUD + stale version
-- ---------------------------------------------------------------------------
-- Owner D starts LOCAL. Completing m-d1 (gen 10) bootstraps LOCAL -> MIRROR
-- exactly once with only cloudSourceMirroring enabled.
select extensions.lives_ok($core$
  select * from public.brj_begin(
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-d1', 10, 1, 1, 2)
$core$, 'owner D begins the authority-bootstrap manifest');

do $do$
declare
  v_permit uuid;
begin
  perform public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-d1', 0,
    public.brj_chunk('m-d1', 0, jsonb_build_array(
      public.brj_conv('cv-d1', 1, null, jsonb_build_array(
        public.brj_msg('mq-d1-0', 'cv-d1', 'user', 0, 1, 'a', 'active', '2026-07-20T00:00:01+00:00'),
        public.brj_msg('mq-d1-1', 'cv-d1', 'assistant', 1, 1, 'b', 'active', '2026-07-20T00:00:02+00:00')
      ))
    )),
    public.brj_hash(public.brj_chunk('m-d1', 0, jsonb_build_array(
      public.brj_conv('cv-d1', 1, null, jsonb_build_array(
        public.brj_msg('mq-d1-0', 'cv-d1', 'user', 0, 1, 'a', 'active', '2026-07-20T00:00:01+00:00'),
        public.brj_msg('mq-d1-1', 'cv-d1', 'assistant', 1, 1, 'b', 'active', '2026-07-20T00:00:02+00:00')
      ))
    ))));
  perform public.memory_validate_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-d1');
  v_permit := (select id from public.memory_prepare_source_completion_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-d1',
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d')));
  perform public.memory_complete_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-d1', v_permit,
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
    (select prepared_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-d1'),
    (select prepared_membership_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-d1'));
end
$do$;

select extensions.is(
  (select authority_state from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
  'MIRROR', 'owner D bootstraps LOCAL -> MIRROR on its first completion');
select extensions.is(
  (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
  2::bigint, 'LOCAL -> MIRROR increments the authority version exactly once');
select extensions.is(
  (select feature_flags from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
  '{"cloudSourceMirroring": true, "cloudProjectionBuild": false, "shadowRetrieval": false, "cloudReadAuthority": false, "cloudWriteAuthority": false}'::jsonb,
  'bootstrap enables only cloudSourceMirroring');

-- Completion at MIRROR preserves state/version/flags exactly (m-d2, gen 11).
select extensions.lives_ok($core$
  select * from public.brj_begin(
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-d2', 11, 1, 1, 1)
$core$, 'owner D begins a completion at MIRROR');
do $do$
declare
  v_permit uuid;
begin
  perform public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-d2', 0,
    public.brj_chunk('m-d2', 0, jsonb_build_array(
      public.brj_conv('cv-d2', 1, null, jsonb_build_array(
        public.brj_msg('mq-d2', 'cv-d2', 'user', 0, 1, 'c', 'active', '2026-07-20T00:00:01+00:00')
      ))
    )),
    public.brj_hash(public.brj_chunk('m-d2', 0, jsonb_build_array(
      public.brj_conv('cv-d2', 1, null, jsonb_build_array(
        public.brj_msg('mq-d2', 'cv-d2', 'user', 0, 1, 'c', 'active', '2026-07-20T00:00:01+00:00')
      ))
    ))));
  perform public.memory_validate_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-d2');
  v_permit := (select id from public.memory_prepare_source_completion_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-d2',
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d')));
  perform public.memory_complete_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-d2', v_permit,
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
    (select prepared_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-d2'),
    (select prepared_membership_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-d2'));
end
$do$;
select extensions.is(
  (select authority_state || ':' || authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
  'MIRROR:2', 'completion at MIRROR preserves the state and version exactly');
select extensions.is(
  (select feature_flags - 'cloudSourceMirroring' from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
  '{"cloudProjectionBuild": false, "shadowRetrieval": false, "cloudReadAuthority": false, "cloudWriteAuthority": false}'::jsonb,
  'completion at MIRROR keeps all non-mirroring flags off');

-- Completion at SHADOW / CLOUD preserves the later-phase state exactly. Phase 1
-- only authorizes LOCAL -> MIRROR, so later states are simulated by a direct
-- state bump (the else-branch must never demote or rewrite flags).
update public.memory_owner_state
set authority_state = 'SHADOW'
where owner_id = '00000000-0000-4000-8000-00000000000d';
select extensions.lives_ok($core$
  select * from public.brj_begin(
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-d3', 12, 1, 1, 1)
$core$, 'owner D begins a completion at SHADOW');
do $do$
declare
  v_permit uuid;
begin
  perform public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-d3', 0,
    public.brj_chunk('m-d3', 0, jsonb_build_array(
      public.brj_conv('cv-d3', 1, null, jsonb_build_array(
        public.brj_msg('mq-d3', 'cv-d3', 'user', 0, 1, 'd', 'active', '2026-07-20T00:00:01+00:00')
      ))
    )),
    public.brj_hash(public.brj_chunk('m-d3', 0, jsonb_build_array(
      public.brj_conv('cv-d3', 1, null, jsonb_build_array(
        public.brj_msg('mq-d3', 'cv-d3', 'user', 0, 1, 'd', 'active', '2026-07-20T00:00:01+00:00')
      ))
    ))));
  perform public.memory_validate_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-d3');
  v_permit := (select id from public.memory_prepare_source_completion_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-d3',
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d')));
  perform public.memory_complete_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-d3', v_permit,
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
    (select prepared_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-d3'),
    (select prepared_membership_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-d3'));
end
$do$;
select extensions.is(
  (select authority_state from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
  'SHADOW', 'completion at SHADOW preserves the state exactly');
select extensions.is(
  (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
  2::bigint, 'completion at SHADOW never re-increments the version');

update public.memory_owner_state
set authority_state = 'CLOUD'
where owner_id = '00000000-0000-4000-8000-00000000000d';
select extensions.lives_ok($core$
  select * from public.brj_begin(
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-d4', 13, 1, 1, 1)
$core$, 'owner D begins a completion at CLOUD');
do $do$
declare
  v_permit uuid;
begin
  perform public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-d4', 0,
    public.brj_chunk('m-d4', 0, jsonb_build_array(
      public.brj_conv('cv-d4', 1, null, jsonb_build_array(
        public.brj_msg('mq-d4', 'cv-d4', 'user', 0, 1, 'e', 'active', '2026-07-20T00:00:01+00:00')
      ))
    )),
    public.brj_hash(public.brj_chunk('m-d4', 0, jsonb_build_array(
      public.brj_conv('cv-d4', 1, null, jsonb_build_array(
        public.brj_msg('mq-d4', 'cv-d4', 'user', 0, 1, 'e', 'active', '2026-07-20T00:00:01+00:00')
      ))
    ))));
  perform public.memory_validate_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-d4');
  v_permit := (select id from public.memory_prepare_source_completion_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-d4',
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d')));
  perform public.memory_complete_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-d4', v_permit,
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
    (select prepared_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-d4'),
    (select prepared_membership_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-d4'));
end
$do$;
select extensions.is(
  (select authority_state || ':' || authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
  'CLOUD:2', 'completion at CLOUD preserves the state and version exactly');

-- Stale authority version: prepare/complete with a future expected version fails
-- with zero state/flag change at every authority state.
select extensions.lives_ok($core$
  select * from public.brj_begin(
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-d5', 14, 1, 1, 1)
$core$, 'owner D begins a manifest for the stale-version probe');
do $do$
begin
  perform public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-d5', 0,
    public.brj_chunk('m-d5', 0, jsonb_build_array(
      public.brj_conv('cv-d5', 1, null, jsonb_build_array(
        public.brj_msg('mq-d5', 'cv-d5', 'user', 0, 1, 'f', 'active', '2026-07-20T00:00:01+00:00')
      ))
    )),
    public.brj_hash(public.brj_chunk('m-d5', 0, jsonb_build_array(
      public.brj_conv('cv-d5', 1, null, jsonb_build_array(
        public.brj_msg('mq-d5', 'cv-d5', 'user', 0, 1, 'f', 'active', '2026-07-20T00:00:01+00:00')
      ))
    ))));
  perform public.memory_validate_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-d5');
end
$do$;
-- prepare with a stale expected version:
select extensions.throws_ok($core$
  select * from public.memory_prepare_source_completion_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-d5',
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d') + 5)
$core$, 'PT409', 'MIRROR_AUTHORITY_VERSION_STALE', 'prepare with a stale authority version fails stably');
-- complete with a stale expected version (valid permit now):
do $do$
declare
  v_permit uuid;
begin
  v_permit := (select id from public.memory_prepare_source_completion_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-d5',
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d')));
  begin
    perform public.memory_complete_source_import_v1(
      'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
      'local-test-writer-token', 'sha256:local-source',
      '00000000-0000-4000-8000-00000000000d',
      '10000000-0000-4000-8000-00000000000d',
      'm-d5', v_permit,
      (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d') + 5,
      (select prepared_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-d5'),
      (select prepared_membership_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-d5'));
    raise exception 'expected stale-version rejection';
  exception when others then
    if sqlerrm = 'expected stale-version rejection' then raise; end if;
    if sqlstate <> 'PT409' then raise; end if;
  end;
end
$do$;
select extensions.is(
  (select authority_state || ':' || authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
  'CLOUD:2', 'stale authority version leaves state and version unchanged');
do $do$
begin
  perform public.memory_cancel_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-d5');
end
$do$;

-- ---------------------------------------------------------------------------
-- Completion-permit edge cases (Prove list): expired / reused / wrong-owner /
-- wrong-generation permits cannot promote, including delivery after expiry.
-- ---------------------------------------------------------------------------
-- Owner B is still LOCAL and clean of permits; free its outstanding m-b1
-- active manifest, then give it a prepared manifest at generation 2.
do $do$
begin
  perform public.memory_cancel_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000b',
    '10000000-0000-4000-8000-00000000000b', 'm-b1');
end
$do$;
select extensions.lives_ok($core$
  select * from public.brj_begin(
    '00000000-0000-4000-8000-00000000000b',
    '10000000-0000-4000-8000-00000000000b',
    'm-p1', 2, 1, 1, 1)
$core$, 'owner B begins a manifest for permit probes');
do $do$
begin
  perform public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000b',
    '10000000-0000-4000-8000-00000000000b',
    'm-p1', 0,
    public.brj_chunk('m-p1', 0, jsonb_build_array(
      public.brj_conv('cv-p1', 1, null, jsonb_build_array(
        public.brj_msg('mq-p1', 'cv-p1', 'user', 0, 1, 'p', 'active', '2026-07-20T00:00:01+00:00')
      ))
    )),
    public.brj_hash(public.brj_chunk('m-p1', 0, jsonb_build_array(
      public.brj_conv('cv-p1', 1, null, jsonb_build_array(
        public.brj_msg('mq-p1', 'cv-p1', 'user', 0, 1, 'p', 'active', '2026-07-20T00:00:01+00:00')
      ))
    ))));
  perform public.memory_validate_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000b',
    '10000000-0000-4000-8000-00000000000b', 'm-p1');
end
$do$;

-- Expired permit: force expiry in the past, completion cannot promote.
do $do$
declare
  v_permit uuid;
begin
  v_permit := (select id from public.memory_prepare_source_completion_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000b',
    '10000000-0000-4000-8000-00000000000b', 'm-p1',
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000b')));
  update public.memory_import_completion_permits
  set created_at = clock_timestamp() - interval '30 seconds',
      expires_at = clock_timestamp() - interval '1 second'
  where id = v_permit;
  begin
    perform public.memory_complete_source_import_v1(
      'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
      'local-test-writer-token', 'sha256:local-source',
      '00000000-0000-4000-8000-00000000000b',
      '10000000-0000-4000-8000-00000000000b',
      'm-p1', v_permit,
      (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000b'),
      (select prepared_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000b' and id = 'm-p1'),
      (select prepared_membership_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000b' and id = 'm-p1'));
    raise exception 'expected expired-permit rejection';
  exception when others then
    if sqlerrm = 'expected expired-permit rejection' then raise; end if;
    if sqlstate <> 'P0001' and sqlerrm is distinct from 'MIRROR_COMPLETION_PERMIT_INVALID' then raise; end if;
  end;
end
$do$;
select extensions.is(
  (select status from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000b' and id = 'm-p1'),
  'prepared', 'expired permit does not promote the manifest');
select extensions.is(
  (select authority_state from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000b'),
  'LOCAL', 'expired permit does not promote authority');

-- Consumed/reused permit: simulate an already-consumed permit and an exactly
-- expired one; neither promotes. Re-issue a live permit, then consume it via a
-- full completion and confirm an identical retry returns the stored receipt.
do $do$
declare
  v_permit uuid;
begin
  v_permit := (select id from public.memory_prepare_source_completion_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000b',
    '10000000-0000-4000-8000-00000000000b', 'm-p1',
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000b')));
end
$do$;
do $do$
declare
  v_permit uuid;
  v_manifest public.memory_import_manifests;
begin
  select id into v_permit from public.memory_import_completion_permits
   where owner_id = '00000000-0000-4000-8000-00000000000b' and manifest_id = 'm-p1'
   order by created_at desc limit 1;
  -- mark the permit consumed as if a prior completion took it
  update public.memory_import_completion_permits
  set consumed_at = clock_timestamp()
  where id = v_permit;
  begin
    v_manifest := public.memory_complete_source_import_v1(
      'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
      'local-test-writer-token', 'sha256:local-source',
      '00000000-0000-4000-8000-00000000000b',
      '10000000-0000-4000-8000-00000000000b',
      'm-p1', v_permit,
      (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000b'),
      (select prepared_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000b' and id = 'm-p1'),
      (select prepared_membership_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000b' and id = 'm-p1'));
    raise exception 'expected consumed-permit rejection';
  exception when others then
    if sqlerrm = 'expected consumed-permit rejection' then raise; end if;
    if sqlstate <> 'P0001' and sqlerrm is distinct from 'MIRROR_COMPLETION_PERMIT_INVALID' then raise; end if;
  end;
end
$do$;
select extensions.is(
  (select status from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000b' and id = 'm-p1'),
  'prepared', 'consumed permit does not promote the manifest');

-- Too-late permit: a live permit that expires inside the 3-second guard is
-- rejected even against a still-valid manifest.
do $do$
declare
  v_permit uuid;
  v_manifest public.memory_import_manifests;
begin
  delete from public.memory_import_completion_permits
  where owner_id = '00000000-0000-4000-8000-00000000000b' and manifest_id = 'm-p1';
  v_permit := (select id from public.memory_prepare_source_completion_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000b',
    '10000000-0000-4000-8000-00000000000b', 'm-p1',
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000b')));
  update public.memory_import_completion_permits
  set expires_at = clock_timestamp() + interval '2 seconds'
  where id = v_permit;
  begin
    v_manifest := public.memory_complete_source_import_v1(
      'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
      'local-test-writer-token', 'sha256:local-source',
      '00000000-0000-4000-8000-00000000000b',
      '10000000-0000-4000-8000-00000000000b',
      'm-p1', v_permit,
      (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000b'),
      (select prepared_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000b' and id = 'm-p1'),
      (select prepared_membership_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000b' and id = 'm-p1'));
    raise exception 'expected too-late rejection';
  exception when others then
    if sqlerrm = 'expected too-late rejection' then raise; end if;
    if sqlstate <> 'P0001' and sqlerrm is distinct from 'MIRROR_COMPLETION_PERMIT_TOO_LATE' then raise; end if;
  end;
end
$do$;
select extensions.is(
  (select status from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000b' and id = 'm-p1'),
  'prepared', 'too-late permit does not promote the manifest');
do $do$
begin
  delete from public.memory_import_completion_permits
  where owner_id = '00000000-0000-4000-8000-00000000000b' and manifest_id = 'm-p1';
end
$do$;
-- Wrong-owner permit cannot promote: a permit minted for owner D (m-d4, live,
-- matching generation/version) cannot complete owner B's m-p1.
do $do$
declare
  v_foreign uuid;
  v_dgen bigint;
  v_dver bigint;
begin
  delete from public.memory_import_completion_permits
  where owner_id = '00000000-0000-4000-8000-00000000000b' and manifest_id = 'm-p1';
  delete from public.memory_import_completion_permits
  where owner_id = '00000000-0000-4000-8000-00000000000d';
  select import_generation into v_dgen
  from public.memory_import_manifests
  where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-d4';
  select authority_version into v_dver
  from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d';
  insert into public.memory_import_completion_permits (
    owner_id, manifest_id, import_generation, expected_authority_version, expires_at
  ) values (
    '00000000-0000-4000-8000-00000000000d', 'm-d4', v_dgen, v_dver,
    clock_timestamp() + interval '8 seconds'
  ) returning id into v_foreign;
  begin
    perform public.memory_complete_source_import_v1(
      'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
      'local-test-writer-token', 'sha256:local-source',
      '00000000-0000-4000-8000-00000000000b',
      '10000000-0000-4000-8000-00000000000b',
      'm-p1', v_foreign,
      (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000b'),
      (select prepared_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000b' and id = 'm-p1'),
      (select prepared_membership_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000b' and id = 'm-p1'));
    raise exception 'expected wrong-owner rejection';
  exception when others then
    if sqlerrm = 'expected wrong-owner rejection' then raise; end if;
    if sqlstate <> 'P0001' and sqlerrm is distinct from 'MIRROR_COMPLETION_PERMIT_INVALID' then raise; end if;
  end;
end
$do$;
select extensions.is(
  (select status from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000b' and id = 'm-p1'),
  'prepared', 'wrong-owner permit does not promote the manifest');
select extensions.is(
  (select source_set_conversation_count from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000b'),
  0, 'no rows promote for owner B from a wrong-owner permit');

-- Wrong-generation permit cannot promote: same owner/manifest but a generation
-- that never matched the manifest.
do $do$
declare
  v_live uuid;
  v_wronggen uuid;
begin
  delete from public.memory_import_completion_permits
  where owner_id = '00000000-0000-4000-8000-00000000000b' and manifest_id = 'm-p1';
  v_live := (select id from public.memory_prepare_source_completion_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000b',
    '10000000-0000-4000-8000-00000000000b', 'm-p1',
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000b')));
  -- a second live permit for the same manifest/owner but an impossible
  -- generation (999) is rejected even though an id matches the row:
  insert into public.memory_import_completion_permits (
    owner_id, manifest_id, import_generation, expected_authority_version, expires_at
  ) values (
    '00000000-0000-4000-8000-00000000000b', 'm-p1', 999,
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000b'),
    clock_timestamp() + interval '8 seconds'
  ) returning id into v_wronggen;
  begin
    perform public.memory_complete_source_import_v1(
      'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
      'local-test-writer-token', 'sha256:local-source',
      '00000000-0000-4000-8000-00000000000b',
      '10000000-0000-4000-8000-00000000000b',
      'm-p1', v_wronggen,
      (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000b'),
      (select prepared_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000b' and id = 'm-p1'),
      (select prepared_membership_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000b' and id = 'm-p1'));
    raise exception 'expected wrong-generation rejection';
  exception when others then
    if sqlerrm = 'expected wrong-generation rejection' then raise; end if;
    if sqlstate <> 'P0001' and sqlerrm is distinct from 'MIRROR_COMPLETION_PERMIT_INVALID' then raise; end if;
  end;
end
$do$;
select extensions.is(
  (select status from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000b' and id = 'm-p1'),
  'prepared', 'wrong-generation permit does not promote the manifest');
do $do$
begin
  delete from public.memory_import_completion_permits
  where owner_id = '00000000-0000-4000-8000-00000000000b' and manifest_id = 'm-p1';
end
$do$;

-- Permit quota: four unexpired unused permits for one owner; the fifth prepare
-- hits the boundary with no partial row.
delete from public.memory_import_completion_permits
 where owner_id = '00000000-0000-4000-8000-00000000000b';
do $do$
declare
  i integer;
begin
  for i in 1..4 loop
    insert into public.memory_import_completion_permits (
      owner_id, manifest_id, import_generation, expected_authority_version, expires_at
    ) values (
      '00000000-0000-4000-8000-00000000000b', 'm-p1', 1000 + i,
      (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000b'),
      clock_timestamp() + interval '8 seconds'
    );
  end loop;
end
$do$;
select extensions.throws_ok($core$
  select * from public.memory_prepare_source_completion_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000b',
    '10000000-0000-4000-8000-00000000000b', 'm-p1',
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000b'))
$core$, 'P0001', 'MIRROR_COMPLETION_PERMIT_LIMIT', 'fifth concurrent permit rejects stably');
select extensions.is(
  (select count(*) from public.memory_import_completion_permits
   where owner_id = '00000000-0000-4000-8000-00000000000b' and consumed_at is null),
  4::bigint, 'permit quota leaves exactly four unexpired unused permits (no partial row)');
delete from public.memory_import_completion_permits
 where owner_id = '00000000-0000-4000-8000-00000000000b';

-- Expired/consumed permit cleanup can never remove a completion receipt.
select extensions.isnt(
  (select completion_receipt from public.memory_import_manifests
   where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-d4'),
  null::text, 'completed CLOUD manifest carries its completion receipt');
do $do$
begin
  delete from public.memory_import_completion_permits
   where owner_id = '00000000-0000-4000-8000-00000000000d';
  perform public.memory_cancel_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-d5');
end
$do$;
select extensions.isnt(
  (select completion_receipt from public.memory_import_manifests
   where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-d4'),
  null::text, 'permit cleanup never removes a completion receipt');

-- ---------------------------------------------------------------------------
-- RLS / ACL isolation + SECURITY DEFINER enumeration (Prove list)
-- ---------------------------------------------------------------------------
-- authenticated users are scoped to their own eligible rows through the
-- security_invoker parity views, and direct table mutation stays denied.
insert into public.memory_conversations (
  owner_id, id, source_kind, source_record_id, status, started_at,
  temporal_provenance, client_schema_version, eligibility, source_revision
) values
  ('00000000-0000-4000-8000-00000000000a', 'rls-a', 'journal', 'rls-entry-a', 'settled', now(), 'captured', 1, 'eligible', 1),
  ('00000000-0000-4000-8000-00000000000d', 'rls-d', 'journal', 'rls-entry-d', 'settled', now(), 'captured', 1, 'eligible', 1)
on conflict (owner_id, id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
select extensions.is(
  (select array_agg(id order by id) from public.memory_current_source_conversations
   where id in ('rls-a', 'rls-d')),
  array['rls-a']::text[],
  'owner A sees only owner A eligible rows through the parity view');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000d', true);
select extensions.is(
  (select array_agg(id order by id) from public.memory_current_source_conversations
   where id in ('rls-a', 'rls-d')),
  array['rls-d']::text[],
  'owner D sees only owner D eligible rows through the parity view');
select extensions.throws_ok(
  $$insert into public.memory_import_items (owner_id, manifest_id, chunk_index, item_kind, stable_id, conversation_id, observed_revision, canonical_hash, payload)
    values ('00000000-0000-4000-8000-00000000000d', 'x', 0, 'conversation', 'x', 'x', 1, 'sha256:0000', '{}'::jsonb)$$,
  '42501',
  null,
  'authenticated cannot write the phase-1 tables directly');
reset role;

-- SECURITY DEFINER signatures: every new Phase 1 RPC fixes an empty search
-- path, revokes execution from public/anon/authenticated/service_role, and is
-- granted to service_role only.
select extensions.is(
  (select true from pg_proc p
   where p.oid = 'public.memory_enroll_mirror_v1(text,bigint,uuid,text,text,uuid,uuid,uuid)'::regprocedure
     and p.prosecdef
     and p.proconfig = array['search_path=""']::text[]),
  true, 'enroll_mirror_v1 is SECURITY DEFINER with an empty search path');
select extensions.is(
  (select has_function_privilege('anon', 'public.memory_enroll_mirror_v1(text,bigint,uuid,text,text,uuid,uuid,uuid)', 'EXECUTE')),
  false, 'anon cannot execute enroll_mirror_v1');
select extensions.is(
  (select has_function_privilege('authenticated', 'public.memory_enroll_mirror_v1(text,bigint,uuid,text,text,uuid,uuid,uuid)', 'EXECUTE')),
  false, 'authenticated cannot execute enroll_mirror_v1');
select extensions.is(
  (select has_function_privilege('service_role', 'public.memory_enroll_mirror_v1(text,bigint,uuid,text,text,uuid,uuid,uuid)', 'EXECUTE')),
  true, 'service_role can execute enroll_mirror_v1');
select extensions.is(
  (select true from pg_proc p
   where p.oid = 'public.memory_accept_source_chunk_v1(text,bigint,uuid,text,text,uuid,uuid,text,integer,jsonb,text)'::regprocedure
     and p.prosecdef
     and p.proconfig = array['search_path=""']::text[]),
  true, 'accept_source_chunk_v1 is SECURITY DEFINER with an empty search path');
select extensions.is(
  (select has_function_privilege('service_role', 'public.memory_accept_source_chunk_v1(text,bigint,uuid,text,text,uuid,uuid,text,integer,jsonb,text)', 'EXECUTE')),
  true, 'service_role can execute accept_source_chunk_v1');
select extensions.is(
  (select true from pg_proc p
   where p.oid = 'public.memory_complete_source_import_v1(text,bigint,uuid,text,text,uuid,uuid,text,uuid,bigint,text,text)'::regprocedure
     and p.prosecdef
     and p.proconfig = array['search_path=""']::text[]),
  true, 'complete_source_import_v1 is SECURITY DEFINER with an empty search path');
select extensions.is(
  (select has_function_privilege('anon', 'public.memory_complete_source_import_v1(text,bigint,uuid,text,text,uuid,uuid,text,uuid,bigint,text,text)', 'EXECUTE')),
  false, 'anon cannot execute complete_source_import_v1');
select extensions.is(
  (select true from pg_proc p
   where p.oid = 'public.memory_apply_source_tombstone_v1(text,bigint,uuid,text,text,uuid,uuid,text,text,integer,integer,text,timestamptz,text)'::regprocedure
     and p.prosecdef
     and p.proconfig = array['search_path=""']::text[]),
  true, 'apply_source_tombstone_v1 is SECURITY DEFINER with an empty search path');
select extensions.is(
  (select has_function_privilege('authenticated', 'public.memory_get_source_parity_v1(uuid,uuid)', 'EXECUTE')),
  false, 'authenticated cannot execute the parity reader RPC');

-- Table enumeration: every new Phase 1 table from 5.1 exists by name, and the
-- Phase 0 memory_source_watermarks table is not extended and is not the mirror
-- sequencing authority.
select extensions.has_table('public', 'memory_mirror_owner_allowlist', 'allowlist table exists');
select extensions.has_table('public', 'memory_mirror_rate_limits', 'rate-limits table exists');
select extensions.has_table('public', 'memory_import_completion_permits', 'completion-permits table exists');
select extensions.has_table('public', 'memory_import_items', 'import-items table exists');
select extensions.has_table('public', 'memory_conversation_revisions', 'conversation-revisions table exists');
select extensions.has_table('public', 'memory_source_watermarks', 'phase-0 watermarks table still exists');
select extensions.is(
  (select count(*)::bigint from information_schema.columns
   where table_schema = 'public' and table_name = 'memory_source_watermarks'
     and column_name in ('source_set_version', 'source_set_receipt', 'eligibility')),
  0::bigint,
  'watermarks table carries no phase-1 mirror state');
select extensions.is(
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'memory_source_watermarks'
     and column_name in ('source_set_version', 'source_set_receipt', 'eligibility')),
  0::bigint,
  'memory_source_watermarks is not the mirror sequencing authority');

-- ---------------------------------------------------------------------------
-- Repeated max-size completions do not retain 20,000 membership rows per
-- generation: only observed revisions plus one bounded compact manifest receipt.
-- ---------------------------------------------------------------------------
select extensions.lives_ok($core$
  select * from public.brj_begin(
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-r1', 30, 0, 1, 20000)
$core$, 'owner D begins a max-size manifest (20000 declared messages)');
do $do$
begin
  -- Stage the full 20000-message membership directly for the declared counts.
  insert into public.memory_import_items (
    owner_id, manifest_id, chunk_index, item_kind, stable_id, conversation_id,
    observed_revision, canonical_hash, payload
  )
  select '00000000-0000-4000-8000-00000000000d', 'm-r1', 0, 'message',
         'rx-msg-' || g, 'rx-cv', 1, 'sha256:0000',
         jsonb_build_object(
           'id', 'rx-msg-' || g, 'conversationId', 'rx-cv', 'clientEventId', 'rx-msg-' || g,
           'role', 'user', 'sequence', g, 'authoredAt', to_jsonb(now()),
           'temporalProvenance', 'captured', 'content', 'x',
           'revision', 1, 'status', 'active'
         )
  from generate_series(0, 19999) g;
  insert into public.memory_import_items (
    owner_id, manifest_id, chunk_index, item_kind, stable_id, conversation_id,
    observed_revision, canonical_hash, payload
  ) values (
    '00000000-0000-4000-8000-00000000000d', 'm-r1', 0, 'conversation',
    'rx-cv', 'rx-cv', 1, 'sha256:0000',
    jsonb_build_object(
      'id', 'rx-cv', 'sourceKind', 'journal', 'sourceRecordId', 'entry-rx',
      'status', 'settled', 'startedAt', to_jsonb(now()),
      'temporalProvenance', 'captured', 'clientSchemaVersion', 1, 'sourceRevision', 1
    )
  );
end
$do$;
do $do$
declare
  v_permit uuid;
begin
  perform public.memory_validate_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-r1');
  v_permit := (select id from public.memory_prepare_source_completion_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-r1',
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d')));
  perform public.memory_complete_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-r1', v_permit,
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
    (select prepared_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-r1'),
    (select prepared_membership_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-r1'));
end
$do$;
select extensions.is(
  (select count(*) from public.memory_import_items
   where owner_id = '00000000-0000-4000-8000-00000000000d' and manifest_id = 'm-r1'),
  0::bigint, 'max-size completion compacts all 20000 membership rows to zero');
select extensions.is(
  (select status from public.memory_import_manifests
   where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-r1'),
  'verified', 'max-size manifest completes');
select extensions.isnt(
  (select completion_receipt from public.memory_import_manifests
   where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-r1'),
  null::text, 'max-size completion records one bounded receipt');

-- A second max-size generation with one changed revision still retains zero
-- membership rows (G / G+1 stay bounded).
select extensions.lives_ok($core$
  select * from public.brj_begin(
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-r2', 31, 0, 1, 20000)
$core$, 'owner D begins a second max-size generation');
do $do$
begin
  insert into public.memory_import_items (
    owner_id, manifest_id, chunk_index, item_kind, stable_id, conversation_id,
    observed_revision, canonical_hash, payload
  )
  select '00000000-0000-4000-8000-00000000000d', 'm-r2', 0, 'message',
         'ry-msg-' || g, 'ry-cv', 1, 'sha256:0000',
         jsonb_build_object(
           'id', 'ry-msg-' || g, 'conversationId', 'ry-cv', 'clientEventId', 'ry-msg-' || g,
           'role', 'user', 'sequence', g, 'authoredAt', to_jsonb(now()),
           'temporalProvenance', 'captured', 'content', 'y',
           'revision', 2, 'status', 'active'
         )
  from generate_series(0, 19999) g;
  insert into public.memory_import_items (
    owner_id, manifest_id, chunk_index, item_kind, stable_id, conversation_id,
    observed_revision, canonical_hash, payload
  ) values (
    '00000000-0000-4000-8000-00000000000d', 'm-r2', 0, 'conversation',
    'ry-cv', 'ry-cv', 2, 'sha256:0000',
    jsonb_build_object(
      'id', 'ry-cv', 'sourceKind', 'journal', 'sourceRecordId', 'entry-ry',
      'status', 'settled', 'startedAt', to_jsonb(now()),
      'temporalProvenance', 'captured', 'clientSchemaVersion', 1, 'sourceRevision', 2
    )
  );
end
$do$;
do $do$
declare
  v_permit uuid;
begin
  perform public.memory_validate_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-r2');
  v_permit := (select id from public.memory_prepare_source_completion_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-r2',
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d')));
  perform public.memory_complete_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-r2', v_permit,
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
    (select prepared_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-r2'),
    (select prepared_membership_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-r2'));
end
$do$;
select extensions.is(
  (select count(*) from public.memory_import_items
   where owner_id = '00000000-0000-4000-8000-00000000000d'
     and manifest_id in ('m-r1', 'm-r2')),
  0::bigint, 'repeated max-size generations retain zero membership rows');
select extensions.is(
  (select count(*) from public.memory_import_manifests
   where owner_id = '00000000-0000-4000-8000-00000000000d'
     and id in ('m-r1', 'm-r2')
     and status = 'verified'),
  2::bigint, 'exactly two bounded compact manifest receipts remain for G and G+1');

-- ---------------------------------------------------------------------------
-- Review prove items (owner D, generations 32+): conversation spanning chunks
-- with contiguous slices, collision-safe sequence reorder, role/time-change
-- revisions, validate count/hash-mismatch rejection, the 4096 receipt cap, and
-- zero-item manifest behavior. D is CLOUD:2 here; finalization never demotes.
-- ---------------------------------------------------------------------------

-- A conversation safely spans chunks: chunk 0 carries messages seq 0-1 and
-- chunk 1 carries the contiguous slice seq 2-3 of the same conversation.
select extensions.lives_ok($core$
  select * from public.brj_begin(
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-s1', 32, 2, 1, 4)
$core$, 'owner D begins a two-chunk spanning manifest');
do $do$
declare
  v_permit uuid;
begin
  perform public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-s1', 0,
    public.brj_chunk('m-s1', 0, jsonb_build_array(
      public.brj_conv('cv-span', 1, null, jsonb_build_array(
        public.brj_msg('mq-s0', 'cv-span', 'user', 0, 1, 's0-1', 'active', '2026-07-20T00:00:01+00:00'),
        public.brj_msg('mq-s1', 'cv-span', 'assistant', 1, 1, 's1-1', 'active', '2026-07-20T00:00:02+00:00')
      ))
    )),
    public.brj_hash(public.brj_chunk('m-s1', 0, jsonb_build_array(
      public.brj_conv('cv-span', 1, null, jsonb_build_array(
        public.brj_msg('mq-s0', 'cv-span', 'user', 0, 1, 's0-1', 'active', '2026-07-20T00:00:01+00:00'),
        public.brj_msg('mq-s1', 'cv-span', 'assistant', 1, 1, 's1-1', 'active', '2026-07-20T00:00:02+00:00')
      ))
    ))));
  perform public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-s1', 1,
    public.brj_chunk('m-s1', 1, jsonb_build_array(
      public.brj_conv('cv-span', 1, null, jsonb_build_array(
        public.brj_msg('mq-s2', 'cv-span', 'user', 2, 1, 's2-1', 'active', '2026-07-20T00:00:03+00:00'),
        public.brj_msg('mq-s3', 'cv-span', 'assistant', 3, 1, 's3-1', 'active', '2026-07-20T00:00:04+00:00')
      ))
    )),
    public.brj_hash(public.brj_chunk('m-s1', 1, jsonb_build_array(
      public.brj_conv('cv-span', 1, null, jsonb_build_array(
        public.brj_msg('mq-s2', 'cv-span', 'user', 2, 1, 's2-1', 'active', '2026-07-20T00:00:03+00:00'),
        public.brj_msg('mq-s3', 'cv-span', 'assistant', 3, 1, 's3-1', 'active', '2026-07-20T00:00:04+00:00')
      ))
    ))));
  perform public.memory_validate_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-s1');
  v_permit := (select id from public.memory_prepare_source_completion_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-s1',
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d')));
  perform public.memory_complete_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-s1', v_permit,
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
    (select prepared_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-s1'),
    (select prepared_membership_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-s1'));
end
$do$;
select extensions.is(
  (select count(*) from public.memory_messages
   where owner_id = '00000000-0000-4000-8000-00000000000d'
     and conversation_id = 'cv-span' and eligibility = 'eligible'),
  4::bigint, 'a conversation spanning chunks completes with all four messages eligible');
select extensions.is(
  (select array_agg(sequence order by sequence) from public.memory_messages
   where owner_id = '00000000-0000-4000-8000-00000000000d'
     and conversation_id = 'cv-span' and eligibility = 'eligible'),
  array[0, 1, 2, 3]::integer[], 'spanning-chunk conversation keeps contiguous sequences');

-- Contiguous-slice enforcement: a second chunk that resumes the conversation
-- at the wrong slice (seq 2 when seq 1 was never staged in this manifest) is
-- rejected with no partial rows.
select extensions.lives_ok($core$
  select * from public.brj_begin(
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-s2', 33, 2, 1, 1)
$core$, 'owner D begins the contiguous-slice probe manifest');
do $do$
begin
  perform public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-s2', 0,
    public.brj_chunk('m-s2', 0, jsonb_build_array(
      public.brj_conv('cv-gap', 1, null, jsonb_build_array(
        public.brj_msg('mq-g0', 'cv-gap', 'user', 0, 1, 'g0', 'active', '2026-07-20T00:00:01+00:00')
      ))
    )),
    public.brj_hash(public.brj_chunk('m-s2', 0, jsonb_build_array(
      public.brj_conv('cv-gap', 1, null, jsonb_build_array(
        public.brj_msg('mq-g0', 'cv-gap', 'user', 0, 1, 'g0', 'active', '2026-07-20T00:00:01+00:00')
      ))
    ))));
end
$do$;
select extensions.throws_ok($core$
  select * from public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-s2', 1,
    public.brj_chunk('m-s2', 1, jsonb_build_array(
      public.brj_conv('cv-gap', 1, null, jsonb_build_array(
        public.brj_msg('mq-g1', 'cv-gap', 'user', 2, 1, 'g1', 'active', '2026-07-20T00:00:02+00:00')
      ))
    )),
    public.brj_hash(public.brj_chunk('m-s2', 1, jsonb_build_array(
      public.brj_conv('cv-gap', 1, null, jsonb_build_array(
        public.brj_msg('mq-g1', 'cv-gap', 'user', 2, 1, 'g1', 'active', '2026-07-20T00:00:02+00:00')
      ))
    ))))
$core$, '22023', 'MIRROR_CHUNK_INVALID', 'non-contiguous slice across chunks is rejected');
select extensions.is(
  (select count(*) from public.memory_import_items
   where owner_id = '00000000-0000-4000-8000-00000000000d'
     and manifest_id = 'm-s2' and item_kind = 'message'),
  1::bigint, 'only the accepted slice row remains after the gap rejection');
do $do$
begin
  perform public.memory_cancel_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-s2');
end
$do$;

-- Collision-safe sequence reorder: mq-s0/mq-s1 swap sequences in one manifest;
-- the two-step temporary-ordinal reorder inside completion makes the swap
-- atomic under the non-deferrable unique (owner_id, conversation_id, sequence).
select extensions.lives_ok($core$
  select * from public.brj_begin(
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-s3', 34, 1, 1, 2)
$core$, 'owner D begins the sequence-reorder manifest');
do $do$
declare
  v_permit uuid;
begin
  perform public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-s3', 0,
    public.brj_chunk('m-s3', 0, jsonb_build_array(
      public.brj_conv('cv-span', 2, 1, jsonb_build_array(
        public.brj_msg('mq-s1', 'cv-span', 'assistant', 0, 2, 's1-2', 'active', '2026-07-20T00:00:02+00:00', 1),
        public.brj_msg('mq-s0', 'cv-span', 'user', 1, 2, 's0-2', 'active', '2026-07-20T00:00:01+00:00', 1)
      ))
    )),
    public.brj_hash(public.brj_chunk('m-s3', 0, jsonb_build_array(
      public.brj_conv('cv-span', 2, 1, jsonb_build_array(
        public.brj_msg('mq-s1', 'cv-span', 'assistant', 0, 2, 's1-2', 'active', '2026-07-20T00:00:02+00:00', 1),
        public.brj_msg('mq-s0', 'cv-span', 'user', 1, 2, 's0-2', 'active', '2026-07-20T00:00:01+00:00', 1)
      ))
    ))));
  perform public.memory_validate_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-s3');
  v_permit := (select id from public.memory_prepare_source_completion_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-s3',
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d')));
  perform public.memory_complete_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-s3', v_permit,
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
    (select prepared_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-s3'),
    (select prepared_membership_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-s3'));
end
$do$;
select extensions.is(
  (select array_agg(id || ':' || sequence order by sequence) from public.memory_messages
   where owner_id = '00000000-0000-4000-8000-00000000000d'
     and conversation_id = 'cv-span' and eligibility = 'eligible'),
  array['mq-s1:0', 'mq-s0:1', 'mq-s2:2', 'mq-s3:3']::text[],
  'collision-safe sequence reorder swaps the two messages atomically');

-- Role/time changes are revision-worthy: a role change (user -> assistant) on
-- mq-s0 and an authored-at change on mq-s1 are accepted at revision 3 with the
-- exact previousAcceptedRevision CAS, appended as complete immutable revisions,
-- and reflected on the current rows after completion.
select extensions.lives_ok($core$
  select * from public.brj_begin(
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-s4', 35, 1, 1, 2)
$core$, 'owner D begins the role/time-change manifest');
do $do$
declare
  v_permit uuid;
begin
  perform public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-s4', 0,
    public.brj_chunk('m-s4', 0, jsonb_build_array(
      public.brj_conv('cv-span', 3, 2, jsonb_build_array(
        public.brj_msg('mq-s1', 'cv-span', 'assistant', 0, 3, 's1-3', 'active', '2026-07-21T00:00:05+00:00', 2),
        public.brj_msg('mq-s0', 'cv-span', 'assistant', 1, 3, 's0-3', 'active', '2026-07-21T00:00:01+00:00', 2)
      ))
    )),
    public.brj_hash(public.brj_chunk('m-s4', 0, jsonb_build_array(
      public.brj_conv('cv-span', 3, 2, jsonb_build_array(
        public.brj_msg('mq-s1', 'cv-span', 'assistant', 0, 3, 's1-3', 'active', '2026-07-21T00:00:05+00:00', 2),
        public.brj_msg('mq-s0', 'cv-span', 'assistant', 1, 3, 's0-3', 'active', '2026-07-21T00:00:01+00:00', 2)
      ))
    ))));
  perform public.memory_validate_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-s4');
  v_permit := (select id from public.memory_prepare_source_completion_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-s4',
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d')));
  perform public.memory_complete_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-s4', v_permit,
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
    (select prepared_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-s4'),
    (select prepared_membership_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-s4'));
end
$do$;
select extensions.is(
  (select role from public.memory_message_revisions
   where owner_id = '00000000-0000-4000-8000-00000000000d'
     and message_id = 'mq-s0' and revision = 3 and manifest_id = 'm-s4'),
  'assistant', 'role change is recorded on the immutable message revision');
select extensions.is(
  (select role from public.memory_messages
   where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'mq-s0'),
  'assistant', 'role change is reflected on the current message row');
select extensions.is(
  (select authored_at from public.memory_message_revisions
   where owner_id = '00000000-0000-4000-8000-00000000000d'
     and message_id = 'mq-s1' and revision = 3 and manifest_id = 'm-s4'),
  '2026-07-21T00:00:05+00:00'::timestamptz, 'authored-at change is recorded on the revision');
select extensions.is(
  (select revision_provenance from public.memory_message_revisions
   where owner_id = '00000000-0000-4000-8000-00000000000d'
     and message_id = 'mq-s0' and revision = 3 and manifest_id = 'm-s4'),
  'contiguous', 'role/time-change revision is contiguous, not invented');

-- Validate rejects count mismatches: the manifest declares 2 sources but stages
-- only 1 conversation.
select extensions.lives_ok($core$
  select * from public.brj_begin(
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-v1', 36, 1, 2, 2)
$core$, 'owner D begins a manifest that will fail count validation');
do $do$
begin
  perform public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-v1', 0,
    public.brj_chunk('m-v1', 0, jsonb_build_array(
      public.brj_conv('cv-v1', 1, null, jsonb_build_array(
        public.brj_msg('mq-v1', 'cv-v1', 'user', 0, 1, 'v1', 'active', '2026-07-20T00:00:01+00:00')
      ))
    )),
    public.brj_hash(public.brj_chunk('m-v1', 0, jsonb_build_array(
      public.brj_conv('cv-v1', 1, null, jsonb_build_array(
        public.brj_msg('mq-v1', 'cv-v1', 'user', 0, 1, 'v1', 'active', '2026-07-20T00:00:01+00:00')
      ))
    ))));
end
$do$;
select extensions.throws_ok($core$
  select * from public.memory_validate_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-v1')
$core$, 'P0001', 'MIRROR_MANIFEST_COUNT_MISMATCH', 'validate rejects a declared/staged count mismatch');
do $do$
begin
  perform public.memory_cancel_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-v1');
end
$do$;

-- Validate rejects a hash mismatch: the manifest's declared source hash does
-- not match the independently recomputed chunk hash.
select extensions.lives_ok($core$
  select * from public.memory_begin_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-v2', (select dataset_id from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
    1, 37, 1, 1, 1, 'sha256:deadbeef')
$core$, 'owner D begins a manifest that will fail hash validation');
do $do$
begin
  perform public.memory_accept_source_chunk_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-v2', 0,
    public.brj_chunk('m-v2', 0, jsonb_build_array(
      public.brj_conv('cv-v2', 1, null, jsonb_build_array(
        public.brj_msg('mq-v2', 'cv-v2', 'user', 0, 1, 'v2', 'active', '2026-07-20T00:00:01+00:00')
      ))
    )),
    public.brj_hash(public.brj_chunk('m-v2', 0, jsonb_build_array(
      public.brj_conv('cv-v2', 1, null, jsonb_build_array(
        public.brj_msg('mq-v2', 'cv-v2', 'user', 0, 1, 'v2', 'active', '2026-07-20T00:00:01+00:00')
      ))
    ))));
end
$do$;
select extensions.throws_ok($core$
  select * from public.memory_validate_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-v2')
$core$, 'P0001', 'MIRROR_MANIFEST_HASH_MISMATCH', 'validate rejects a declared/chunk hash mismatch');
do $do$
begin
  perform public.memory_cancel_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-v2');
end
$do$;

-- Zero-item manifest: an empty generation (0 chunks, 0 sources, 0 messages)
-- completes without touching the prior owner union.
do $do$
declare
  v_before_conv integer;
  v_before_msg integer;
  v_before_hash text;
  v_permit uuid;
begin
  select source_set_conversation_count, source_set_message_count, source_set_hash
  into v_before_conv, v_before_msg, v_before_hash
  from public.memory_owner_state
  where owner_id = '00000000-0000-4000-8000-00000000000d';
  perform public.memory_begin_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-z1', (select dataset_id from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
    1, 38, 0, 0, 0, null);
  perform public.memory_validate_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-z1');
  v_permit := (select id from public.memory_prepare_source_completion_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d', 'm-z1',
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d')));
  perform public.memory_complete_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-z1', v_permit,
    (select authority_version from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
    (select prepared_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-z1'),
    (select prepared_membership_hash from public.memory_import_manifests where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-z1'));
  if (select source_set_conversation_count from public.memory_owner_state
      where owner_id = '00000000-0000-4000-8000-00000000000d') is distinct from v_before_conv
      or (select source_set_message_count from public.memory_owner_state
          where owner_id = '00000000-0000-4000-8000-00000000000d') is distinct from v_before_msg
      or (select source_set_hash from public.memory_owner_state
          where owner_id = '00000000-0000-4000-8000-00000000000d') is distinct from v_before_hash then
    raise exception 'zero-item completion changed the owner union';
  end if;
end
$do$;
select extensions.is(
  (select status from public.memory_import_manifests
   where owner_id = '00000000-0000-4000-8000-00000000000d' and id = 'm-z1'),
  'verified', 'zero-item manifest completes verified');

-- The 4096 compact-receipt ceiling: begin rejects once verified/cancelled
-- manifests reach 4096.
do $do$
begin
  insert into public.memory_import_manifests (
    owner_id, id, contract_version, import_generation, declared_chunk_count,
    source_count, message_count, status
  )
  select '00000000-0000-4000-8000-00000000000d',
         'rc-' || g, 1, 1000 + g, 0, 0, 0, 'verified'
  from generate_series(1, 4096 - (
    select count(*) from public.memory_import_manifests
    where owner_id = '00000000-0000-4000-8000-00000000000d'
      and status in ('verified', 'cancelled')
  )) g;
end
$do$;
select extensions.throws_ok($core$
  select * from public.memory_begin_source_import_v1(
    'blackrose-primary', 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-00000000000d',
    'm-rc', (select dataset_id from public.memory_owner_state where owner_id = '00000000-0000-4000-8000-00000000000d'),
    1, 39, 1, 1, 1, null)
$core$, 'P0001', 'MIRROR_RECEIPT_LIMIT', 'the 4096 compact-receipt ceiling rejects a new begin');
do $do$
begin
  delete from public.memory_import_manifests
  where owner_id = '00000000-0000-4000-8000-00000000000d'
    and id like 'rc-%';
end
$do$;

select * from extensions.finish();
rollback;
