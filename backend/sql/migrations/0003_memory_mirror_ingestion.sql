-- 0003_memory_mirror_ingestion.sql
--
-- Phase 1 atomic MIRROR ingestion (plan section 5).
--
-- This migration is additive. It never drops, rewrites, or recreates a Phase 0
-- table. The Phase 0 `memory_source_watermarks` table is NOT extended and is
-- never the mirror sequencing authority (plan section 4.2): mirror RPCs never
-- read or write it; the mirror sequencing authority is the per-source /
-- per-message revision cursors and the active manifest's staged state.

-- ---------------------------------------------------------------------------
-- 1. Owner state: server-issued dataset ID, generations, owner-current-source-set
-- ---------------------------------------------------------------------------
alter table public.memory_owner_state
  add column dataset_id uuid,
  add column greatest_import_generation bigint not null default 0
    check (greatest_import_generation between 0 and 9007199254740991),
  add column greatest_completed_generation bigint not null default 0
    check (greatest_completed_generation between 0 and 9007199254740991),
  add column current_source_manifest_id text,
  add column source_set_version bigint not null default 0
    check (source_set_version between 0 and 9007199254740991),
  add column source_set_receipt text,
  add column source_set_conversation_count integer not null default 0
    check (source_set_conversation_count >= 0),
  add column source_set_message_count integer not null default 0
    check (source_set_message_count >= 0),
  add column source_set_hash text;

-- ---------------------------------------------------------------------------
-- 2. Conversations: positive mirror source revision, staged/eligible/deleted
--    eligibility, honest first_observed/contiguous/coalesced_gap provenance,
--    and audit-only current_source_manifest_id (never read membership).
-- ---------------------------------------------------------------------------
alter table public.memory_conversations
  add column source_revision integer
    check (source_revision is null or source_revision > 0),
  add column previous_accepted_revision integer,
  add column revision_provenance text not null default 'first_observed'
    check (revision_provenance in ('first_observed', 'contiguous', 'coalesced_gap')),
  add column gap_start_revision integer,
  add column gap_end_revision integer,
  add column eligibility text not null default 'staged'
    check (eligibility in ('staged', 'eligible', 'deleted')),
  add column current_source_manifest_id text;
alter table public.memory_conversations
  add constraint memory_conversations_revision_gap_check check (
    (revision_provenance = 'coalesced_gap'
      and gap_start_revision is not null
      and gap_end_revision is not null
      and gap_start_revision > 0
      and gap_end_revision >= gap_start_revision)
    or (revision_provenance <> 'coalesced_gap'
      and gap_start_revision is null
      and gap_end_revision is null)
  );

-- ---------------------------------------------------------------------------
-- 3. Messages: mirror eligibility and provenance fields (additive).
-- ---------------------------------------------------------------------------
alter table public.memory_messages
  add column source_revision integer
    check (source_revision is null or source_revision > 0),
  add column previous_accepted_revision integer,
  add column revision_provenance text not null default 'first_observed'
    check (revision_provenance in ('first_observed', 'contiguous', 'coalesced_gap')),
  add column gap_start_revision integer,
  add column gap_end_revision integer,
  add column eligibility text not null default 'staged'
    check (eligibility in ('staged', 'eligible', 'deleted')),
  add column current_source_manifest_id text;
alter table public.memory_messages
  add constraint memory_messages_revision_gap_check check (
    (revision_provenance = 'coalesced_gap'
      and gap_start_revision is not null
      and gap_end_revision is not null
      and gap_start_revision > 0
      and gap_end_revision >= gap_start_revision)
    or (revision_provenance <> 'coalesced_gap'
      and gap_start_revision is null
      and gap_end_revision is null)
  );

-- ---------------------------------------------------------------------------
-- 4. Message revisions: a revision is a complete canonical record (role,
--    sequence, status, source revision, provenance, gap bounds, staging
--    manifest). The Phase 0 eligibility check is widened to admit 'staged'.
-- ---------------------------------------------------------------------------
alter table public.memory_message_revisions
  add column conversation_id text,
  add column role text
    check (role in ('user', 'assistant', 'system', 'tool')),
  add column sequence integer
    check (sequence >= 0),
  add column status text
    check (status in ('active', 'edited', 'deleted')),
  add column source_revision integer
    check (source_revision is null or source_revision > 0),
  add column previous_accepted_revision integer,
  add column revision_provenance text not null default 'first_observed'
    check (revision_provenance in ('first_observed', 'contiguous', 'coalesced_gap')),
  add column gap_start_revision integer,
  add column gap_end_revision integer,
  add column manifest_id text;
alter table public.memory_message_revisions
  drop constraint memory_message_revisions_eligibility_check;
alter table public.memory_message_revisions
  add constraint memory_message_revisions_eligibility_check
    check (eligibility in ('staged', 'eligible', 'withheld', 'deleted', 'expired'));
alter table public.memory_message_revisions
  add constraint memory_message_revisions_mirror_gap_check check (
    (revision_provenance = 'coalesced_gap'
      and gap_start_revision is not null
      and gap_end_revision is not null)
    or (revision_provenance <> 'coalesced_gap'
      and gap_start_revision is null
      and gap_end_revision is null)
  );

-- ---------------------------------------------------------------------------
-- 5. Deletion ledger: stable tombstone receipts, the original ineligibility
--    counts (rows this tombstone de-eligibilized, measured before its sweeps),
--    and resulting owner-union metadata (additive; existing unique deletion
--    keys are untouched).
-- ---------------------------------------------------------------------------
alter table public.memory_deletion_ledger
  add column mirror_receipt text,
  add column mirror_ineligible_conversation_count integer
    check (mirror_ineligible_conversation_count is null or mirror_ineligible_conversation_count >= 0),
  add column mirror_ineligible_message_count integer
    check (mirror_ineligible_message_count is null or mirror_ineligible_message_count >= 0),
  add column mirror_source_set_version bigint
    check (mirror_source_set_version is null or mirror_source_set_version >= 0),
  add column mirror_source_set_receipt text,
  add column mirror_source_set_conversation_count integer
    check (mirror_source_set_conversation_count is null or mirror_source_set_conversation_count >= 0),
  add column mirror_source_set_message_count integer
    check (mirror_source_set_message_count is null or mirror_source_set_message_count >= 0),
  add column mirror_source_set_hash text;

-- ---------------------------------------------------------------------------
-- 6. Import manifests: phase 1 parity/completion fields and the bounded
--    compact ordered chunk-receipt summary. Status gains 'receiving' and
--    'prepared' (additive enum widening only).
-- ---------------------------------------------------------------------------
alter table public.memory_import_manifests
  add column import_generation bigint not null default 0
    check (import_generation between 0 and 9007199254740991),
  add column dataset_id uuid,
  add column declared_chunk_count integer not null default 0
    check (declared_chunk_count between 0 and 160),
  add column prepared_at timestamptz,
  add column prepared_chunk_receipt jsonb not null default '[]'::jsonb
    check (jsonb_typeof(prepared_chunk_receipt) = 'array'),
  add column prepared_item_count integer,
  add column prepared_conversation_count integer,
  add column prepared_message_count integer,
  add column prepared_hash text,
  add column prepared_membership_hash text,
  add column completion_receipt text,
  add column cancellation_receipt text,
  add column completion_authority_version bigint,
  add column completion_source_set_version bigint,
  add column completion_source_set_receipt text,
  add column completion_source_set_conversation_count integer,
  add column completion_source_set_message_count integer,
  add column completion_source_set_hash text,
  add column completed_at timestamptz,
  add column latest_error_code text;
alter table public.memory_import_manifests
  drop constraint memory_import_manifests_status_check;
alter table public.memory_import_manifests
  add constraint memory_import_manifests_status_check
    check (status in (
      'created', 'uploading', 'receiving', 'prepared', 'verified', 'failed', 'cancelled'
    ));

-- ---------------------------------------------------------------------------
-- 7. Import chunks: server count/hash receipt fields (additive).
-- ---------------------------------------------------------------------------
alter table public.memory_import_chunks
  add column conversation_count integer not null default 0
    check (conversation_count between 0 and 16),
  add column message_count integer not null default 0
    check (message_count between 0 and 128),
  add column encoded_bytes integer not null default 0
    check (encoded_bytes between 0 and 262144),
  add column payload_hash text,
  add column receipt text,
  add column compacted_at timestamptz;

-- ---------------------------------------------------------------------------
-- 8. New Phase 1 tables (plan section 5.1, exact names).
-- ---------------------------------------------------------------------------
create table public.memory_mirror_owner_allowlist (
  owner_id uuid primary key,
  enabled boolean not null default true,
  enabled_at timestamptz not null default clock_timestamp(),
  disabled_at timestamptz,
  note text not null default '' check (length(note) <= 512),
  check (
    (enabled and disabled_at is null)
    or (not enabled and disabled_at is not null)
  )
);

create table public.memory_mirror_rate_limits (
  owner_id uuid primary key,
  minute_window_started_at timestamptz not null,
  minute_request_count integer not null default 0
    check (minute_request_count between 0 and 30),
  minute_request_timestamps jsonb not null default '[]'::jsonb
    check (
      jsonb_typeof(minute_request_timestamps) = 'array'
      and jsonb_array_length(minute_request_timestamps) <= 30
    ),
  day_started_on date not null,
  day_request_count integer not null default 0
    check (day_request_count between 0 and 1000),
  updated_at timestamptz not null default clock_timestamp()
);

create table public.memory_conversation_revisions (
  id bigint generated always as identity,
  owner_id uuid not null,
  conversation_id text not null,
  source_revision integer not null check (source_revision > 0),
  previous_accepted_revision integer,
  source_kind text not null
    check (source_kind in ('journal', 'intention_checkin')),
  source_record_id text not null,
  status text not null check (status in ('settled', 'deleted')),
  started_at timestamptz not null,
  settled_at timestamptz,
  timezone text,
  week_starts_on smallint check (week_starts_on in (0, 1)),
  temporal_provenance text not null
    check (temporal_provenance in ('captured', 'legacy_unknown')),
  client_schema_version integer not null check (client_schema_version > 0),
  revision_provenance text not null
    check (revision_provenance in ('first_observed', 'contiguous', 'coalesced_gap')),
  gap_start_revision integer,
  gap_end_revision integer,
  eligibility text not null
    check (eligibility in ('staged', 'eligible', 'deleted')),
  manifest_id text,
  canonical_hash text not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (id),
  unique (owner_id, id),
  unique (owner_id, conversation_id, source_revision),
  foreign key (owner_id, conversation_id)
    references public.memory_conversations (owner_id, id) on delete cascade,
  check (
    (revision_provenance = 'coalesced_gap'
      and gap_start_revision is not null
      and gap_end_revision is not null
      and gap_start_revision > 0
      and gap_end_revision >= gap_start_revision)
    or (revision_provenance <> 'coalesced_gap'
      and gap_start_revision is null
      and gap_end_revision is null)
  )
);

create table public.memory_import_items (
  id bigint generated always as identity,
  owner_id uuid not null,
  manifest_id text not null,
  chunk_index integer not null check (chunk_index >= 0),
  item_kind text not null check (item_kind in ('conversation', 'message')),
  stable_id text not null,
  conversation_id text not null,
  observed_revision integer not null check (observed_revision > 0),
  canonical_hash text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  primary key (id),
  unique (owner_id, manifest_id, item_kind, stable_id, observed_revision),
  foreign key (owner_id, manifest_id)
    references public.memory_import_manifests (owner_id, id) on delete cascade
);

create table public.memory_import_completion_permits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  manifest_id text not null,
  import_generation bigint not null check (import_generation >= 0),
  expected_authority_version bigint not null check (expected_authority_version >= 1),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique (owner_id, manifest_id, import_generation),
  foreign key (owner_id, manifest_id)
    references public.memory_import_manifests (owner_id, id) on delete cascade,
  check (expires_at > created_at)
);

-- ---------------------------------------------------------------------------
-- 9. Owner-first indexes: active import, chunk cursor, membership, eligible
--    source inventory, deletion lookup, and the one-active-manifest fence.
-- ---------------------------------------------------------------------------
create index memory_import_manifests_active_owner_idx
  on public.memory_import_manifests (owner_id, created_at, id)
  where status in ('created', 'uploading', 'receiving', 'prepared');
create unique index memory_import_manifests_generation_unique
  on public.memory_import_manifests (owner_id, import_generation);
create unique index memory_import_manifests_one_active_owner_idx
  on public.memory_import_manifests (owner_id)
  where status in ('created', 'uploading', 'receiving', 'prepared');
create index memory_import_chunks_cursor_idx
  on public.memory_import_chunks (owner_id, manifest_id, chunk_index);
create index memory_import_items_manifest_idx
  on public.memory_import_items (owner_id, manifest_id, item_kind, stable_id);
create index memory_import_items_conversation_idx
  on public.memory_import_items (owner_id, conversation_id, manifest_id);
create index memory_conversations_eligible_idx
  on public.memory_conversations (owner_id, id)
  where eligibility = 'eligible';
create index memory_messages_eligible_idx
  on public.memory_messages (owner_id, conversation_id, sequence, id)
  where eligibility = 'eligible';
create index memory_deletion_ledger_mirror_lookup_idx
  on public.memory_deletion_ledger (owner_id, source_kind, source_id, source_revision desc);
create index memory_conversation_revisions_owner_conversation_idx
  on public.memory_conversation_revisions (owner_id, conversation_id, source_revision desc);
create index memory_message_revisions_owner_message_idx
  on public.memory_message_revisions (owner_id, message_id, revision desc);
create index memory_message_revisions_owner_manifest_staged_idx
  on public.memory_message_revisions (owner_id, manifest_id)
  where eligibility = 'staged';
create index memory_import_completion_permits_owner_expiry_idx
  on public.memory_import_completion_permits (owner_id, expires_at)
  where consumed_at is null;

-- ---------------------------------------------------------------------------
-- 10. Current-source / parity views. Eligible current rows are authoritative
--     for the mirrored owner union; `current_source_manifest_id` is audit-only
--     and never defines read membership. Views are security_invoker so RLS on
--     the underlying owner tables scopes reads per signed-in owner.
-- ---------------------------------------------------------------------------
create view public.memory_current_source_conversations
with (security_invoker = true) as
  select
    id, owner_id, source_kind, source_record_id, status, started_at, settled_at,
    timezone, week_starts_on, temporal_provenance, client_schema_version,
    source_hash, deleted_at, created_at, updated_at, source_revision,
    previous_accepted_revision, revision_provenance, gap_start_revision,
    gap_end_revision, eligibility, current_source_manifest_id
  from public.memory_conversations conversation
  where eligibility = 'eligible';

create view public.memory_current_source_messages
with (security_invoker = true) as
  select
    message.id, message.owner_id, message.conversation_id, message.client_event_id,
    message.role, message.sequence, message.authored_at, message.authored_timezone,
    message.local_date, message.temporal_provenance, message.content,
    message.content_hash, message.revision, message.status, message.deleted_at,
    message.created_at, message.updated_at, message.source_revision,
    message.previous_accepted_revision, message.revision_provenance,
    message.gap_start_revision, message.gap_end_revision, message.eligibility,
    message.current_source_manifest_id
  from public.memory_messages message
  join public.memory_conversations conversation
    on conversation.owner_id = message.owner_id
    and conversation.id = message.conversation_id
  where message.eligibility = 'eligible'
    and conversation.eligibility = 'eligible';

-- ---------------------------------------------------------------------------
-- 11. Hash helpers (canonical JSONB hashing; plan section 4.4).
-- ---------------------------------------------------------------------------
create or replace function public.memory_deterministic_json_hash(p_value jsonb)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select 'sha256:' || encode(
    sha256(convert_to(p_value::text, 'UTF8')), 'hex'
  )
$$;

-- Explicit versioned UTF-8 line format (golden vectors). Field order, null
-- marker, integer format, length-prefixing, and byte encoding are fixed here.
create or replace function public.memory_canonical_mirror_chunk(p_chunk jsonb)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_conversation jsonb;
  v_message jsonb;
  v_result text := 'BRJ-MIRROR-SOURCE-V1' || E'\n';
  v_message_count integer;
  v_total_messages integer := 0;
  v_field text;
begin
  if p_chunk is null or jsonb_typeof(p_chunk) <> 'object'
    or (select array_agg(value order by value) from jsonb_object_keys(p_chunk) as key(value)) <> array['chunkIndex', 'contractVersion', 'conversations', 'manifestId'] then
    raise exception using errcode = '22023', message = 'MIRROR_CHUNK_CONTRACT_INVALID';
  end if;
  if jsonb_typeof(p_chunk->'contractVersion') <> 'number' or (p_chunk->>'contractVersion')::integer <> 1
    or jsonb_typeof(p_chunk->'manifestId') <> 'string' or p_chunk->>'manifestId' = ''
    or jsonb_typeof(p_chunk->'chunkIndex') <> 'number' or (p_chunk->>'chunkIndex')::integer < 0
    or jsonb_typeof(p_chunk->'conversations') <> 'array'
    or jsonb_array_length(p_chunk->'conversations') not between 1 and 16 then
    raise exception using errcode = '22023', message = 'MIRROR_CHUNK_CONTRACT_INVALID';
  end if;
  v_result := v_result || 'contractVersion:I1' || E'\n'
    || 'manifestId:S' || octet_length((p_chunk->>'manifestId')) || ':' || (p_chunk->>'manifestId') || E'\n'
    || 'chunkIndex:I' || (p_chunk->>'chunkIndex') || E'\n'
    || 'conversationCount:I' || jsonb_array_length((p_chunk->'conversations')) || E'\n';
  for v_conversation in select value from jsonb_array_elements(p_chunk->'conversations') loop
    if jsonb_typeof(v_conversation) <> 'object'
      or (select array_agg(value order by value) from jsonb_object_keys(v_conversation) as key(value)) <> array[
        'clientSchemaVersion', 'id', 'messages', 'previousAcceptedRevision', 'settledAt',
        'sourceKind', 'sourceRecordId', 'sourceRevision', 'startedAt', 'status',
        'temporalProvenance', 'timezone', 'weekStartsOn'
      ]
      or v_conversation->>'sourceKind' not in ('journal', 'intention_checkin')
      or v_conversation->>'status' <> 'settled'
      or v_conversation->>'id' = '' or v_conversation->>'sourceRecordId' = ''
      or jsonb_typeof(v_conversation->'sourceRevision') <> 'number'
      or (v_conversation->>'sourceRevision')::integer < 1
      or jsonb_typeof(v_conversation->'messages') <> 'array' then
      raise exception using errcode = '22023', message = 'MIRROR_CHUNK_CONTRACT_INVALID';
    end if;
    v_message_count := jsonb_array_length(v_conversation->'messages');
    v_total_messages := v_total_messages + v_message_count;
    if v_total_messages > 128 then
      raise exception using errcode = '22023', message = 'MIRROR_CHUNK_LIMIT';
    end if;
    v_result := v_result || 'conversation' || E'\n';
    foreach v_field in array array[
      'id', 'sourceKind', 'sourceRecordId', 'status', 'startedAt', 'settledAt',
      'timezone', 'weekStartsOn', 'temporalProvenance', 'clientSchemaVersion',
      'sourceRevision', 'previousAcceptedRevision'
    ] loop
      if v_conversation->v_field is null or v_conversation->v_field = 'null'::jsonb then
        v_result := v_result || v_field || ':N' || E'\n';
      elsif jsonb_typeof(v_conversation->v_field) = 'number' then
        v_result := v_result || v_field || ':I' || (v_conversation->>v_field) || E'\n';
      elsif jsonb_typeof(v_conversation->v_field) = 'string' then
        v_result := v_result || v_field || ':S' || octet_length((v_conversation->>v_field))
          || ':' || (v_conversation->>v_field) || E'\n';
      else raise exception using errcode = '22023', message = 'MIRROR_CHUNK_CONTRACT_INVALID'; end if;
    end loop;
    v_result := v_result || 'messageCount:I' || v_message_count || E'\n';
    for v_message in select value from jsonb_array_elements(v_conversation->'messages') loop
      if jsonb_typeof(v_message) <> 'object'
        or (select array_agg(value order by value) from jsonb_object_keys(v_message) as key(value)) <> array[
          'authoredAt', 'authoredTimezone', 'clientEventId', 'content', 'conversationId',
          'id', 'localDate', 'previousAcceptedRevision', 'revision', 'role', 'sequence',
          'status', 'temporalProvenance'
        ]
        or v_message->>'conversationId' is distinct from v_conversation->>'id'
        or v_message->>'id' = '' or v_message->>'clientEventId' is distinct from v_message->>'id'
        or v_message->>'role' not in ('user', 'assistant')
        or v_message->>'status' not in ('active', 'edited', 'deleted')
        or jsonb_typeof(v_message->'sequence') <> 'number' or (v_message->>'sequence')::integer < 0
        or jsonb_typeof(v_message->'revision') <> 'number' or (v_message->>'revision')::integer < 1 then
        raise exception using errcode = '22023', message = 'MIRROR_CHUNK_CONTRACT_INVALID';
      end if;
      v_result := v_result || 'message' || E'\n';
      foreach v_field in array array[
        'id', 'conversationId', 'clientEventId', 'role', 'sequence', 'authoredAt',
        'authoredTimezone', 'localDate', 'temporalProvenance', 'content', 'revision',
        'previousAcceptedRevision', 'status'
      ] loop
        if v_message->v_field is null or v_message->v_field = 'null'::jsonb then
          v_result := v_result || v_field || ':N' || E'\n';
        elsif jsonb_typeof(v_message->v_field) = 'number' then
          v_result := v_result || v_field || ':I' || (v_message->>v_field) || E'\n';
        elsif jsonb_typeof(v_message->v_field) = 'string' then
          v_result := v_result || v_field || ':S' || octet_length((v_message->>v_field))
            || ':' || (v_message->>v_field) || E'\n';
        else raise exception using errcode = '22023', message = 'MIRROR_CHUNK_CONTRACT_INVALID'; end if;
      end loop;
    end loop;
  end loop;
  return v_result;
end;
$$;

create or replace function public.memory_canonical_mirror_chunk_hash(p_chunk jsonb)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select 'sha256:' || encode(
    sha256(
      convert_to(public.memory_canonical_mirror_chunk(p_chunk), 'UTF8')
    ),
    'hex'
  )
$$;

-- ---------------------------------------------------------------------------
-- 12. Owner access assertion: allowlist enablement + live verified session
--     (plan sections 3.1 and 3.5). Every Phase 1 RPC rechecks it.
-- ---------------------------------------------------------------------------
create or replace function public.memory_assert_mirror_owner_access(
  p_owner_id uuid,
  p_session_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_enabled boolean;
begin
  select enabled
  into owner_enabled
  from public.memory_mirror_owner_allowlist
  where owner_id = p_owner_id
  for share;

  if not found then
    raise exception using errcode = 'P0001', message = 'OWNER_NOT_TRUSTED';
  end if;
  if not owner_enabled then
    raise exception using errcode = 'P0001', message = 'OWNER_DISABLED';
  end if;
  if p_session_id is null or not exists (
    select 1
    from auth.sessions
    where id = p_session_id
      and user_id = p_owner_id
      and (not_after is null or not_after > clock_timestamp())
  ) then
    raise exception using errcode = 'P0001', message = 'MEMORY_SESSION_REVOKED';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. Revision CAS (plan section 4.2 / 5.3). Returns honest provenance and
--     exact numeric coalesced-gap bounds; never invents missing revisions.
-- ---------------------------------------------------------------------------
create or replace function public.memory_assert_mirror_revision(
  p_current_revision integer,
  p_incoming_revision integer,
  p_previous_accepted_revision integer,
  p_identical boolean
) returns table (provenance text, gap_start integer, gap_end integer)
language plpgsql
immutable
security definer
set search_path = ''
as $$
begin
  if p_current_revision is null then
    if p_previous_accepted_revision is not null then
      raise exception using errcode = 'PT409', message = 'MIRROR_REVISION_CONFLICT';
    end if;
    return query select 'first_observed'::text, null::integer, null::integer;
  elsif p_incoming_revision = p_current_revision and p_identical then
    return query select 'contiguous'::text, null::integer, null::integer;
  elsif p_incoming_revision <= p_current_revision
      or p_previous_accepted_revision is distinct from p_current_revision then
    raise exception using errcode = 'PT409', message = 'MIRROR_REVISION_CONFLICT';
  elsif p_incoming_revision = p_current_revision + 1 then
    return query select 'contiguous'::text, null::integer, null::integer;
  else
    return query
      select 'coalesced_gap'::text,
             (p_current_revision + 1)::integer,
             (p_incoming_revision - 1)::integer;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 14. Owner-union refresh: atomically advances the owner-current-source-set
--     version and persists the resulting eligible count/hash/receipt. Called
--     once per successful logical completion or accepted tombstone.
-- ---------------------------------------------------------------------------
create or replace function public.memory_mirror_refresh_owner_union(
  p_owner_id uuid,
  p_manifest_id text
) returns public.memory_owner_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.memory_owner_state%rowtype;
  conversation_count integer;
  message_count integer;
  union_hash text;
  union_receipt text;
begin
  select *
  into result
  from public.memory_owner_state
  where owner_id = p_owner_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MIRROR_OWNER_MISSING';
  end if;

  select count(*)::integer
  into conversation_count
  from public.memory_conversations
  where owner_id = p_owner_id
    and eligibility = 'eligible';

  select count(*)::integer
  into message_count
  from public.memory_messages
  where owner_id = p_owner_id
    and eligibility = 'eligible';

  select 'sha256:' || encode(
    sha256(
      convert_to(coalesce(string_agg(value, E'\n' order by value), ''), 'UTF8')
    ),
    'hex'
  )
  into union_hash
  from (
    select 'c:' || id || ':' || source_revision || ':' || coalesce(source_hash, '') as value
    from public.memory_conversations
    where owner_id = p_owner_id and eligibility = 'eligible'
    union all
    select 'm:' || id || ':' || revision || ':' || coalesce(content_hash, '') as value
    from public.memory_messages
    where owner_id = p_owner_id and eligibility = 'eligible'
  ) union_rows;

  union_receipt := 'mirror-union:' || p_manifest_id || ':'
    || (result.source_set_version + 1)::text || ':' || union_hash;

  update public.memory_owner_state
  set source_set_version = source_set_version + 1,
      source_set_receipt = union_receipt,
      source_set_conversation_count = conversation_count,
      source_set_message_count = message_count,
      source_set_hash = union_hash,
      current_source_manifest_id = p_manifest_id,
      updated_at = clock_timestamp()
  where owner_id = p_owner_id
  returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 15. RPC: enroll (plan 3.1-3.3). Idempotent, never demotes a later state.
-- ---------------------------------------------------------------------------
create or replace function public.memory_enroll_mirror_v1(
  p_deployment_id text,
  p_writer_epoch bigint,
  p_writer_lease_id uuid,
  p_writer_lease_token text,
  p_source_credential_fingerprint text,
  p_owner_id uuid,
  p_session_id uuid,
  p_dataset_id uuid
) returns public.memory_owner_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.memory_owner_state%rowtype;
begin
  perform public.memory_assert_writer(
    p_deployment_id, p_writer_epoch, p_writer_lease_id,
    p_writer_lease_token, p_source_credential_fingerprint
  );
  perform public.memory_assert_mirror_owner_access(p_owner_id, p_session_id);

  insert into public.memory_owner_state (owner_id, dataset_id, feature_flags)
  values (
    p_owner_id,
    coalesce(p_dataset_id, gen_random_uuid()),
    jsonb_build_object(
      'cloudSourceMirroring', true,
      'cloudProjectionBuild', false,
      'shadowRetrieval', false,
      'cloudReadAuthority', false,
      'cloudWriteAuthority', false
    )
  )
  on conflict (owner_id) do nothing;

  select *
  into result
  from public.memory_owner_state
  where owner_id = p_owner_id
  for update;

  if p_dataset_id is not null and result.dataset_id is distinct from p_dataset_id then
    raise exception using errcode = 'PT409', message = 'MIRROR_DATASET_MISMATCH';
  end if;
  if result.dataset_id is null then
    update public.memory_owner_state
    set dataset_id = coalesce(p_dataset_id, gen_random_uuid()),
        updated_at = clock_timestamp()
    where owner_id = p_owner_id
    returning * into result;
  end if;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 16. RPC: reserve (plan 5.2). Verifies trust, locks the per-owner rate limit
--     row (skip-locked for bounded backpressure), and reserves the rolling
--     minute / database-day request budget from database time.
-- ---------------------------------------------------------------------------
create or replace function public.memory_reserve_mirror_request_v1(
  p_deployment_id text,
  p_writer_epoch bigint,
  p_writer_lease_id uuid,
  p_writer_lease_token text,
  p_source_credential_fingerprint text,
  p_owner_id uuid,
  p_session_id uuid
) returns public.memory_mirror_rate_limits
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.memory_mirror_rate_limits%rowtype;
  now_value timestamptz := clock_timestamp();
  v_recent_requests jsonb;
  v_retry_after_seconds integer;
begin
  perform public.memory_assert_writer(
    p_deployment_id, p_writer_epoch, p_writer_lease_id,
    p_writer_lease_token, p_source_credential_fingerprint
  );
  perform public.memory_assert_mirror_owner_access(p_owner_id, p_session_id);

  insert into public.memory_mirror_rate_limits (
    owner_id, minute_window_started_at, day_started_on,
    minute_request_count, day_request_count
  ) values (
    p_owner_id, now_value, now_value::date, 0, 0
  )
  on conflict (owner_id) do nothing;

  select *
  into result
  from public.memory_mirror_rate_limits
  where owner_id = p_owner_id
  for update skip locked;

  if not found then
    raise exception using errcode = 'P0001', message = 'MIRROR_RATE_LIMIT_BUSY';
  end if;

  select coalesce(
    jsonb_agg(value order by (value #>> '{}')::timestamptz),
    '[]'::jsonb
  )
  into v_recent_requests
  from jsonb_array_elements(result.minute_request_timestamps)
  where (value #>> '{}')::timestamptz > now_value - interval '1 minute';

  if result.day_started_on <> now_value::date then
    result.day_started_on := now_value::date;
    result.day_request_count := 0;
  end if;

  if jsonb_array_length(v_recent_requests) >= 30 then
    v_retry_after_seconds := greatest(1, ceiling(extract(epoch from (
      ((v_recent_requests->>0)::timestamptz + interval '1 minute') - now_value
    )))::integer);
    raise exception using errcode = 'P0001', message = 'MIRROR_RATE_LIMIT_MINUTE',
      detail = 'RETRY_AFTER_SECONDS=' || v_retry_after_seconds::text;
  end if;
  if result.day_request_count >= 1000 then
    v_retry_after_seconds := greatest(1, ceiling(extract(epoch from (
      (date_trunc('day', now_value) + interval '1 day') - now_value
    )))::integer);
    raise exception using errcode = 'P0001', message = 'MIRROR_RATE_LIMIT_DAY',
      detail = 'RETRY_AFTER_SECONDS=' || v_retry_after_seconds::text;
  end if;

  v_recent_requests := v_recent_requests || jsonb_build_array(to_jsonb(now_value));
  update public.memory_mirror_rate_limits
  set minute_window_started_at = coalesce((v_recent_requests->>0)::timestamptz, now_value),
      minute_request_count = jsonb_array_length(v_recent_requests),
      minute_request_timestamps = v_recent_requests,
      day_started_on = result.day_started_on,
      day_request_count = result.day_request_count + 1,
      updated_at = now_value
  where owner_id = p_owner_id
  returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 17. RPC: begin (plan 5.2/5.3 + section 7.4). Manifests are device-observed
--     mutation generations: generation must exceed the owner's greatest import
--     generation, and at most one active manifest may exist per owner.
-- ---------------------------------------------------------------------------
create or replace function public.memory_begin_source_import_v1(
  p_deployment_id text,
  p_writer_epoch bigint,
  p_writer_lease_id uuid,
  p_writer_lease_token text,
  p_source_credential_fingerprint text,
  p_owner_id uuid,
  p_session_id uuid,
  p_manifest_id text,
  p_dataset_id uuid,
  p_contract_version integer,
  p_import_generation bigint,
  p_declared_chunk_count integer,
  p_source_count integer,
  p_message_count integer,
  p_source_hash text
) returns public.memory_import_manifests
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.memory_import_manifests%rowtype;
  owner_state public.memory_owner_state%rowtype;
  v_constraint text;
begin
  perform public.memory_assert_writer(
    p_deployment_id, p_writer_epoch, p_writer_lease_id,
    p_writer_lease_token, p_source_credential_fingerprint
  );
  perform public.memory_assert_mirror_owner_access(p_owner_id, p_session_id);

  select *
  into owner_state
  from public.memory_owner_state
  where owner_id = p_owner_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MIRROR_ENROLLMENT_REQUIRED';
  end if;
  if owner_state.dataset_id is distinct from p_dataset_id then
    raise exception using errcode = 'PT409', message = 'MIRROR_DATASET_MISMATCH';
  end if;
  if p_import_generation <= owner_state.greatest_import_generation then
    raise exception using errcode = 'PT409', message = 'MIRROR_GENERATION_STALE';
  end if;
  if p_declared_chunk_count < 0 or p_declared_chunk_count > 160
      or p_source_count < 0 or p_source_count > 2560
      or p_message_count < 0 or p_message_count > 20000 then
    raise exception using errcode = '22023', message = 'MIRROR_MANIFEST_LIMIT';
  end if;
  if exists (
    select 1
    from public.memory_import_manifests
    where owner_id = p_owner_id
      and id <> p_manifest_id
      and status in ('created', 'uploading', 'receiving', 'prepared')
  ) then
    raise exception using errcode = 'PT409', message = 'ACTIVE_IMPORT_EXISTS';
  end if;
  if (
    select count(*)
    from public.memory_conversation_revisions
    where owner_id = p_owner_id
  ) + (
    select count(*)
    from public.memory_message_revisions
    where owner_id = p_owner_id
  ) >= 200000 then
    raise exception using errcode = 'P0001', message = 'MIRROR_RETAINED_REVISION_LIMIT';
  end if;
  if (
    select count(*)
    from public.memory_import_manifests
    where owner_id = p_owner_id
      and status in ('verified', 'cancelled')
  ) >= 4096 then
    raise exception using errcode = 'P0001', message = 'MIRROR_RECEIPT_LIMIT';
  end if;

  insert into public.memory_import_manifests (
    owner_id, id, contract_version, import_generation, dataset_id,
    declared_chunk_count, source_count, message_count, source_hash, status
  ) values (
    p_owner_id, p_manifest_id, p_contract_version, p_import_generation,
    p_dataset_id, p_declared_chunk_count, p_source_count, p_message_count,
    p_source_hash, 'created'
  )
  on conflict (owner_id, id) do nothing
  returning * into result;

  if not found then
    select *
    into result
    from public.memory_import_manifests
    where owner_id = p_owner_id
      and id = p_manifest_id
    for update;

    if result.import_generation is distinct from p_import_generation
        or result.dataset_id is distinct from p_dataset_id
        or result.contract_version is distinct from p_contract_version
        or result.declared_chunk_count is distinct from p_declared_chunk_count
        or result.source_count is distinct from p_source_count
        or result.message_count is distinct from p_message_count
        or result.source_hash is distinct from p_source_hash then
      raise exception using errcode = 'PT409', message = 'MEMORY_IDEMPOTENCY_CONFLICT';
    end if;
  else
    update public.memory_owner_state
    set greatest_import_generation = p_import_generation,
        updated_at = clock_timestamp()
    where owner_id = p_owner_id;
  end if;

  return result;
exception when unique_violation then
  -- Narrow the concurrent-insert race remap by constraint: only the
  -- one-active-manifest fence legitimately means ACTIVE_IMPORT_EXISTS; a race
  -- on the per-owner generation-unique index is a stale-generation conflict,
  -- and any other unique violation is re-raised unchanged instead of being
  -- mislabeled.
  get stacked diagnostics v_constraint = constraint_name;
  if v_constraint = 'memory_import_manifests_generation_unique' then
    raise exception using errcode = 'PT409', message = 'MIRROR_GENERATION_STALE';
  elsif v_constraint = 'memory_import_manifests_one_active_owner_idx' then
    raise exception using errcode = 'PT409', message = 'ACTIVE_IMPORT_EXISTS';
  end if;
  raise;
end;
$$;

-- ---------------------------------------------------------------------------
-- 18. RPC: accept chunk (plan 5.3). One transaction, all fourteen effects, any
--     exception rolls back every row. The chunk SHA-256 is always recomputed
--     independently here; the client-supplied hash is never trusted.
-- ---------------------------------------------------------------------------
create or replace function public.memory_accept_source_chunk_v1(
  p_deployment_id text,
  p_writer_epoch bigint,
  p_writer_lease_id uuid,
  p_writer_lease_token text,
  p_source_credential_fingerprint text,
  p_owner_id uuid,
  p_session_id uuid,
  p_manifest_id text,
  p_chunk_index integer,
  p_chunk jsonb,
  p_chunk_hash text
) returns public.memory_import_chunks
language plpgsql
security definer
set search_path = ''
as $$
declare
  manifest public.memory_import_manifests%rowtype;
  result public.memory_import_chunks%rowtype;
  conversation jsonb;
  message jsonb;
  calculated_hash text;
  conversation_hash text;
  message_hash text;
  v_conversation_id text;
  v_message_id text;
  current_conversation public.memory_conversations%rowtype;
  current_message public.memory_messages%rowtype;
  provenance record;
  message_total integer := 0;
  conversation_total integer := 0;
  is_first_observed boolean;
  compact_receipt jsonb;
  v_prospective_conversations integer;
  v_prospective_messages integer;
  v_new_retained_revisions integer;
  v_staged_for_conv integer;
  v_message_ordinal integer;
begin
  perform public.memory_assert_writer(
    p_deployment_id, p_writer_epoch, p_writer_lease_id,
    p_writer_lease_token, p_source_credential_fingerprint
  );
  perform public.memory_assert_mirror_owner_access(p_owner_id, p_session_id);

  select *
  into manifest
  from public.memory_import_manifests
  where owner_id = p_owner_id
    and id = p_manifest_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MIRROR_MANIFEST_NOT_FOUND';
  end if;
  if p_chunk is null or jsonb_typeof(p_chunk) <> 'object'
      or jsonb_typeof(p_chunk->'conversations') <> 'array' then
    raise exception using errcode = '22023', message = 'MIRROR_CHUNK_INVALID';
  end if;

  -- Independently recompute the canonical SHA-256; never trust p_chunk_hash.
  calculated_hash := public.memory_canonical_mirror_chunk_hash(p_chunk);
  if calculated_hash is distinct from p_chunk_hash then
    raise exception using errcode = 'P0001', message = 'MIRROR_CHUNK_HASH_MISMATCH';
  end if;
  if octet_length(convert_to(p_chunk::text, 'UTF8')) > 262144 then
    raise exception using errcode = '22023', message = 'MIRROR_CHUNK_BYTE_LIMIT';
  end if;

  -- A prepared/verified manifest no longer holds chunk rows: rebuild the
  -- identical compact receipt, or conflict on changed input.
  if manifest.status in ('prepared', 'verified') then
    select receipt.value
    into compact_receipt
    from jsonb_array_elements(manifest.prepared_chunk_receipt) receipt(value)
    where (receipt.value->>'index')::integer = p_chunk_index;
    if compact_receipt is null or compact_receipt->>'hash' is distinct from calculated_hash then
      raise exception using errcode = 'PT409', message = 'MEMORY_IDEMPOTENCY_CONFLICT';
    end if;
    result.owner_id := p_owner_id;
    result.manifest_id := p_manifest_id;
    result.chunk_index := p_chunk_index;
    result.conversation_count := (compact_receipt->>'conversations')::integer;
    result.message_count := (compact_receipt->>'messages')::integer;
    result.item_count := result.conversation_count + result.message_count;
    result.chunk_hash := compact_receipt->>'hash';
    result.payload_hash := compact_receipt->>'hash';
    result.receipt := compact_receipt->>'receipt';
    result.status := 'accepted';
    return result;
  end if;

  if manifest.status not in ('created', 'uploading', 'receiving') then
    raise exception using errcode = 'PT409', message = 'MIRROR_MANIFEST_NOT_ACTIVE';
  end if;
  if p_chunk_index < 0 or p_chunk_index >= manifest.declared_chunk_count then
    raise exception using errcode = '22023', message = 'MIRROR_CHUNK_OUT_OF_ORDER';
  end if;

  select *
  into result
  from public.memory_import_chunks
  where owner_id = p_owner_id
    and manifest_id = p_manifest_id
    and chunk_index = p_chunk_index
  for update;
  if found then
    if result.payload_hash is distinct from calculated_hash then
      raise exception using errcode = 'PT409', message = 'MEMORY_IDEMPOTENCY_CONFLICT';
    end if;
    return result;
  end if;

  if p_chunk->>'manifestId' is distinct from p_manifest_id
      or (p_chunk->>'chunkIndex')::integer is distinct from p_chunk_index then
    raise exception using errcode = '22023', message = 'MIRROR_CHUNK_INVALID';
  end if;
  if jsonb_array_length(p_chunk->'conversations') > 16 then
    raise exception using errcode = '22023', message = 'MIRROR_CHUNK_LIMIT';
  end if;

  -- Repeated immutable envelope within one chunk or against prior membership.
  if exists (
    with incoming as (
      select value->>'id' as conversation_id,
             public.memory_deterministic_json_hash(value - 'messages') as envelope_hash
      from jsonb_array_elements(p_chunk->'conversations')
    )
    select 1
    from incoming
    group by conversation_id
    having count(distinct envelope_hash) > 1
  ) or exists (
    select 1
    from jsonb_array_elements(p_chunk->'conversations') incoming(value)
    join public.memory_import_items existing
      on existing.owner_id = p_owner_id
      and existing.manifest_id = p_manifest_id
      and existing.item_kind = 'conversation'
      and existing.stable_id = incoming.value->>'id'
    where existing.observed_revision is distinct from (incoming.value->>'sourceRevision')::integer
      or existing.canonical_hash is distinct from public.memory_deterministic_json_hash(incoming.value - 'messages')
  ) then
    raise exception using errcode = 'PT409', message = 'MIRROR_REPEATED_CONVERSATION_CONFLICT';
  end if;

  select count(*)
  into v_prospective_conversations
  from (
    select stable_id
    from public.memory_import_items
    where owner_id = p_owner_id
      and manifest_id = p_manifest_id
      and item_kind = 'conversation'
    union
    select value->>'id'
    from jsonb_array_elements(p_chunk->'conversations')
  ) identities;
  if v_prospective_conversations > 2560 then
    raise exception using errcode = 'P0001', message = 'MIRROR_STAGING_CONVERSATION_LIMIT';
  end if;

  select count(*)
  into v_prospective_messages
  from (
    select stable_id
    from public.memory_import_items
    where owner_id = p_owner_id
      and manifest_id = p_manifest_id
      and item_kind = 'message'
    union
    select message.value->>'id'
    from jsonb_array_elements(p_chunk->'conversations') conversation(value)
    cross join lateral jsonb_array_elements(conversation.value->'messages') message(value)
  ) identities;
  if v_prospective_messages > 20000 then
    raise exception using errcode = 'P0001', message = 'MIRROR_STAGING_MESSAGE_LIMIT';
  end if;

  select count(*)
  into v_new_retained_revisions
  from (
    select conversation.value->>'id' as stable_id,
           (conversation.value->>'sourceRevision')::integer as revision,
           'conversation'::text as kind
    from jsonb_array_elements(p_chunk->'conversations') conversation(value)
    union
    select message.value->>'id', (message.value->>'revision')::integer, 'message'::text
    from jsonb_array_elements(p_chunk->'conversations') conversation(value)
    cross join lateral jsonb_array_elements(conversation.value->'messages') message(value)
  ) incoming
  where not exists (
    select 1
    from public.memory_conversation_revisions revision
    where incoming.kind = 'conversation'
      and revision.owner_id = p_owner_id
      and revision.conversation_id = incoming.stable_id
      and revision.source_revision = incoming.revision
  ) and not exists (
    select 1
    from public.memory_message_revisions revision
    where incoming.kind = 'message'
      and revision.owner_id = p_owner_id
      and revision.message_id = incoming.stable_id
      and revision.revision = incoming.revision
  );
  if (
    select count(*) from public.memory_conversation_revisions where owner_id = p_owner_id
  ) + (
    select count(*) from public.memory_message_revisions where owner_id = p_owner_id
  ) + v_new_retained_revisions > 200000 then
    raise exception using errcode = 'P0001', message = 'MIRROR_RETAINED_REVISION_LIMIT';
  end if;

  for conversation in select value from jsonb_array_elements(p_chunk->'conversations') loop
    conversation_total := conversation_total + 1;
    v_conversation_id := conversation->>'id';
    if v_conversation_id is null
        or conversation->>'sourceKind' not in ('journal', 'intention_checkin')
        or jsonb_typeof(conversation->'messages') <> 'array' then
      raise exception using errcode = '22023', message = 'MIRROR_CHUNK_INVALID';
    end if;
    if exists (
      select 1
      from public.memory_deletion_ledger
      where owner_id = p_owner_id
        and source_kind = conversation->>'sourceKind'
        and source_id = conversation->>'sourceRecordId'
        and source_revision >= (conversation->>'sourceRevision')::integer
    ) then
      raise exception using errcode = 'PT409', message = 'MIRROR_TOMBSTONE_DOMINATES';
    end if;

    conversation_hash := public.memory_deterministic_json_hash(conversation - 'messages');
    select not exists (
      select 1
      from public.memory_conversations
      where owner_id = p_owner_id and id = v_conversation_id
    )
    into is_first_observed;

    insert into public.memory_conversations (
      owner_id, id, source_kind, source_record_id, status, started_at, settled_at,
      timezone, week_starts_on, temporal_provenance, client_schema_version,
      source_hash, source_revision, previous_accepted_revision,
      revision_provenance, eligibility, current_source_manifest_id
    ) values (
      p_owner_id, v_conversation_id, conversation->>'sourceKind',
      conversation->>'sourceRecordId', conversation->>'status',
      (conversation->>'startedAt')::timestamptz,
      nullif(conversation->>'settledAt', '')::timestamptz,
      nullif(conversation->>'timezone', ''),
      nullif(conversation->>'weekStartsOn', '')::smallint,
      conversation->>'temporalProvenance',
      (conversation->>'clientSchemaVersion')::integer,
      conversation_hash,
      (conversation->>'sourceRevision')::integer,
      nullif(conversation->>'previousAcceptedRevision', '')::integer,
      'first_observed', 'staged', p_manifest_id
    )
    on conflict (owner_id, id) do nothing;

    select *
    into current_conversation
    from public.memory_conversations
    where owner_id = p_owner_id
      and id = v_conversation_id
    for update;

    if is_first_observed then
      select 'first_observed'::text as provenance,
             null::integer as gap_start,
             null::integer as gap_end
      into provenance;
    else
      select *
      into provenance
      from public.memory_assert_mirror_revision(
        current_conversation.source_revision,
        (conversation->>'sourceRevision')::integer,
        nullif(conversation->>'previousAcceptedRevision', '')::integer,
        current_conversation.source_hash = conversation_hash
      );
    end if;

    insert into public.memory_conversation_revisions (
      owner_id, conversation_id, source_revision, previous_accepted_revision,
      source_kind, source_record_id, status, started_at, settled_at, timezone,
      week_starts_on, temporal_provenance, client_schema_version,
      revision_provenance, gap_start_revision, gap_end_revision, eligibility,
      manifest_id, canonical_hash
    ) values (
      p_owner_id, v_conversation_id, (conversation->>'sourceRevision')::integer,
      nullif(conversation->>'previousAcceptedRevision', '')::integer,
      conversation->>'sourceKind', conversation->>'sourceRecordId',
      conversation->>'status', (conversation->>'startedAt')::timestamptz,
      nullif(conversation->>'settledAt', '')::timestamptz,
      nullif(conversation->>'timezone', ''),
      nullif(conversation->>'weekStartsOn', '')::smallint,
      conversation->>'temporalProvenance',
      (conversation->>'clientSchemaVersion')::integer,
      provenance.provenance, provenance.gap_start, provenance.gap_end,
      'staged', p_manifest_id, conversation_hash
    )
    on conflict (owner_id, conversation_id, source_revision) do nothing;

    insert into public.memory_import_items (
      owner_id, manifest_id, chunk_index, item_kind, stable_id, conversation_id,
      observed_revision, canonical_hash, payload
    ) values (
      p_owner_id, p_manifest_id, p_chunk_index, 'conversation', v_conversation_id,
      v_conversation_id, (conversation->>'sourceRevision')::integer,
      conversation_hash, conversation - 'messages'
    )
    on conflict do nothing;

    select count(*)
    into v_staged_for_conv
    from public.memory_import_items
    where owner_id = p_owner_id
      and manifest_id = p_manifest_id
      and item_kind = 'message'
      and conversation_id = v_conversation_id;

    v_message_ordinal := 0;
    for message in select value from jsonb_array_elements(conversation->'messages') loop
      message_total := message_total + 1;
      v_message_id := message->>'id';
      if v_message_id is null
          or message->>'conversationId' is distinct from v_conversation_id then
        raise exception using errcode = '22023', message = 'MIRROR_CHUNK_INVALID';
      end if;
      -- Exact message array order is authoritative for sequence; a conversation
      -- spans chunks with contiguous slices only (plan section 4.3/4.5).
      if (message->>'sequence')::integer <> v_staged_for_conv + v_message_ordinal then
        raise exception using errcode = '22023', message = 'MIRROR_CHUNK_INVALID';
      end if;
      v_message_ordinal := v_message_ordinal + 1;

      message_hash := public.memory_deterministic_json_hash(message);
      select not exists (
        select 1
        from public.memory_messages
        where owner_id = p_owner_id and id = v_message_id
      )
      into is_first_observed;

      insert into public.memory_messages (
        owner_id, id, conversation_id, client_event_id, role, sequence,
        authored_at, authored_timezone, local_date, temporal_provenance,
        content, content_hash, revision, source_revision,
        previous_accepted_revision, revision_provenance, status, eligibility,
        current_source_manifest_id
      ) values (
        p_owner_id, v_message_id, v_conversation_id, message->>'clientEventId',
        message->>'role', (message->>'sequence')::integer,
        (message->>'authoredAt')::timestamptz,
        nullif(message->>'authoredTimezone', ''),
        nullif(message->>'localDate', '')::date,
        message->>'temporalProvenance', message->>'content', message_hash,
        (message->>'revision')::integer, (message->>'revision')::integer,
        nullif(message->>'previousAcceptedRevision', '')::integer,
        'first_observed', message->>'status', 'staged', p_manifest_id
      )
      on conflict (owner_id, id) do nothing;

      select *
      into current_message
      from public.memory_messages
      where owner_id = p_owner_id
        and id = v_message_id
      for update;

      if is_first_observed then
        select 'first_observed'::text as provenance,
               null::integer as gap_start,
               null::integer as gap_end
        into provenance;
      else
        select *
        into provenance
        from public.memory_assert_mirror_revision(
          current_message.source_revision,
          (message->>'revision')::integer,
          nullif(message->>'previousAcceptedRevision', '')::integer,
          current_message.content_hash = message_hash
        );
      end if;

      insert into public.memory_message_revisions (
        owner_id, message_id, revision, content, content_hash, authored_at,
        authored_timezone, local_date, temporal_provenance, lifecycle_reason,
        eligibility, conversation_id, role, sequence, status, source_revision,
        previous_accepted_revision, revision_provenance, gap_start_revision,
        gap_end_revision, manifest_id
      ) values (
        p_owner_id, v_message_id, (message->>'revision')::integer,
        message->>'content', message_hash, (message->>'authoredAt')::timestamptz,
        nullif(message->>'authoredTimezone', ''),
        nullif(message->>'localDate', '')::date,
        message->>'temporalProvenance', 'mirror_ingest', 'staged',
        v_conversation_id, message->>'role', (message->>'sequence')::integer,
        message->>'status', (message->>'revision')::integer,
        nullif(message->>'previousAcceptedRevision', '')::integer,
        provenance.provenance, provenance.gap_start, provenance.gap_end,
        p_manifest_id
      )
      on conflict (owner_id, message_id, revision) do nothing;

      insert into public.memory_import_items (
        owner_id, manifest_id, chunk_index, item_kind, stable_id, conversation_id,
        observed_revision, canonical_hash, payload
      ) values (
        p_owner_id, p_manifest_id, p_chunk_index, 'message', v_message_id,
        v_conversation_id, (message->>'revision')::integer, message_hash, message
      )
      on conflict do nothing;
    end loop;
  end loop;

  if message_total > 128 then
    raise exception using errcode = '22023', message = 'MIRROR_CHUNK_LIMIT';
  end if;

  insert into public.memory_import_chunks (
    owner_id, manifest_id, chunk_index, idempotency_key, item_count,
    conversation_count, message_count, encoded_bytes, chunk_hash, payload_hash,
    receipt, source_kind, highest_client_sequence, highest_client_event_id,
    observed_at, status
  ) values (
    p_owner_id, p_manifest_id, p_chunk_index,
    p_manifest_id || ':' || p_chunk_index::text,
    conversation_total + message_total, conversation_total, message_total,
    octet_length(convert_to(p_chunk::text, 'UTF8')),
    calculated_hash, calculated_hash,
    'mirror-chunk:' || p_manifest_id || ':' || p_chunk_index::text
      || ':' || calculated_hash,
    'journal', 0, null, clock_timestamp(), 'accepted'
  )
  returning * into result;

  update public.memory_import_manifests
  set status = 'receiving'
  where owner_id = p_owner_id
    and id = p_manifest_id;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 19. RPC: get import (read, session-fenced).
-- ---------------------------------------------------------------------------
create or replace function public.memory_get_source_import_v1(
  p_owner_id uuid,
  p_session_id uuid,
  p_manifest_id text
) returns public.memory_import_manifests
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.memory_import_manifests%rowtype;
begin
  perform public.memory_assert_mirror_owner_access(p_owner_id, p_session_id);
  select *
  into result
  from public.memory_import_manifests
  where owner_id = p_owner_id
    and id = p_manifest_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'MIRROR_MANIFEST_NOT_FOUND';
  end if;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 20. RPC: cancel (plan 5.3). Fenced, idempotent, prunes only the cancelled
--     manifest's unverified staging and never touches eligible/verified rows.
-- ---------------------------------------------------------------------------
create or replace function public.memory_cancel_source_import_v1(
  p_deployment_id text,
  p_writer_epoch bigint,
  p_writer_lease_id uuid,
  p_writer_lease_token text,
  p_source_credential_fingerprint text,
  p_owner_id uuid,
  p_session_id uuid,
  p_manifest_id text
) returns public.memory_import_manifests
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.memory_import_manifests%rowtype;
begin
  perform public.memory_assert_writer(
    p_deployment_id, p_writer_epoch, p_writer_lease_id,
    p_writer_lease_token, p_source_credential_fingerprint
  );
  perform public.memory_assert_mirror_owner_access(p_owner_id, p_session_id);

  select *
  into result
  from public.memory_import_manifests
  where owner_id = p_owner_id
    and id = p_manifest_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MIRROR_MANIFEST_NOT_FOUND';
  end if;
  if result.status = 'cancelled' then
    return result;
  end if;
  if result.status in ('verified', 'failed') then
    raise exception using errcode = 'PT409', message = 'MIRROR_MANIFEST_NOT_CANCELLABLE';
  end if;

  update public.memory_import_manifests
  set status = 'cancelled',
      cancellation_receipt = coalesce(cancellation_receipt,
        'mirror-cancel:' || id || ':' || public.memory_deterministic_json_hash(
          jsonb_build_object('owner', owner_id, 'manifest', id)
        )
      ),
      completed_at = clock_timestamp()
  where owner_id = p_owner_id
    and id = p_manifest_id
  returning * into result;

  -- Discard the cancelled manifest's unverified staging and its staged-only
  -- identities; leave eligible/current verified rows, immutable verified
  -- revisions, deletion commitments, and authority untouched.
  delete from public.memory_import_chunks
  where owner_id = p_owner_id and manifest_id = p_manifest_id;
  delete from public.memory_import_items
  where owner_id = p_owner_id and manifest_id = p_manifest_id;
  delete from public.memory_message_revisions
  where owner_id = p_owner_id and manifest_id = p_manifest_id and eligibility = 'staged';
  delete from public.memory_conversation_revisions
  where owner_id = p_owner_id and manifest_id = p_manifest_id and eligibility = 'staged';
  delete from public.memory_messages
  where owner_id = p_owner_id and current_source_manifest_id = p_manifest_id and eligibility = 'staged';
  delete from public.memory_conversations
  where owner_id = p_owner_id and current_source_manifest_id = p_manifest_id and eligibility = 'staged';

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 21. RPC: validate (plan 5.5 heavy step). Requires every declared chunk,
--     validates the mutation set's counts/hashes/membership/revision fences,
--     computes the bounded compact ordered chunk receipt, marks the manifest
--     prepared, and removes bulky chunk rows while retaining import items.
-- ---------------------------------------------------------------------------
create or replace function public.memory_validate_source_import_v1(
  p_deployment_id text,
  p_writer_epoch bigint,
  p_writer_lease_id uuid,
  p_writer_lease_token text,
  p_source_credential_fingerprint text,
  p_owner_id uuid,
  p_session_id uuid,
  p_manifest_id text
) returns public.memory_import_manifests
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.memory_import_manifests%rowtype;
  calculated_hash text;
  v_item_count integer;
  v_conversation_count integer;
  v_message_count integer;
begin
  perform public.memory_assert_writer(
    p_deployment_id, p_writer_epoch, p_writer_lease_id,
    p_writer_lease_token, p_source_credential_fingerprint
  );
  perform public.memory_assert_mirror_owner_access(p_owner_id, p_session_id);

  select *
  into result
  from public.memory_import_manifests
  where owner_id = p_owner_id
    and id = p_manifest_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MIRROR_MANIFEST_NOT_FOUND';
  end if;
  if result.status = 'prepared' then
    return result;
  end if;
  if result.status not in ('created', 'uploading', 'receiving') then
    raise exception using errcode = 'PT409', message = 'MIRROR_MANIFEST_NOT_ACTIVE';
  end if;

  if (
    select count(*)
    from public.memory_import_chunks
    where owner_id = p_owner_id and manifest_id = p_manifest_id
  ) <> result.declared_chunk_count then
    raise exception using errcode = 'P0001', message = 'MIRROR_MANIFEST_CHUNKS_INCOMPLETE';
  end if;
  if exists (
    select 1
    from generate_series(0, result.declared_chunk_count - 1) i
    where not exists (
      select 1
      from public.memory_import_chunks c
      where c.owner_id = p_owner_id
        and c.manifest_id = p_manifest_id
        and c.chunk_index = i
    )
  ) then
    raise exception using errcode = 'P0001', message = 'MIRROR_MANIFEST_CHUNKS_INCOMPLETE';
  end if;

  select count(*)::integer,
         count(*) filter (where item_kind = 'conversation')::integer,
         count(*) filter (where item_kind = 'message')::integer
  into v_item_count, v_conversation_count, v_message_count
  from public.memory_import_items
  where owner_id = p_owner_id
    and manifest_id = p_manifest_id;
  if v_conversation_count <> result.source_count
      or v_message_count <> result.message_count then
    raise exception using errcode = 'P0001', message = 'MIRROR_MANIFEST_COUNT_MISMATCH';
  end if;

  select 'sha256:' || encode(
    sha256(
      convert_to(coalesce(string_agg(chunk_hash, E'\n' order by chunk_index), ''), 'UTF8')
    ),
    'hex'
  )
  into calculated_hash
  from public.memory_import_chunks
  where owner_id = p_owner_id
    and manifest_id = p_manifest_id;
  if result.source_hash is not null
      and result.source_hash is distinct from calculated_hash then
    raise exception using errcode = 'P0001', message = 'MIRROR_MANIFEST_HASH_MISMATCH';
  end if;

  update public.memory_import_manifests
  set status = 'prepared',
      prepared_at = clock_timestamp(),
      prepared_chunk_receipt = (
        select coalesce(jsonb_agg(jsonb_build_object(
          'index', chunk.chunk_index, 'hash', chunk.chunk_hash,
          'receipt', chunk.receipt, 'conversations', chunk.conversation_count,
          'messages', chunk.message_count
        ) order by chunk.chunk_index), '[]'::jsonb)
        from public.memory_import_chunks chunk
        where chunk.owner_id = p_owner_id
          and chunk.manifest_id = p_manifest_id
      ),
      prepared_item_count = v_item_count,
      prepared_conversation_count = v_conversation_count,
      prepared_message_count = v_message_count,
      prepared_hash = calculated_hash,
      prepared_membership_hash = public.memory_deterministic_json_hash(
        (
          select coalesce(jsonb_agg(jsonb_build_object(
            'kind', item_kind, 'id', stable_id, 'revision', observed_revision,
            'hash', canonical_hash
          ) order by item_kind, stable_id, observed_revision), '[]'::jsonb)
          from public.memory_import_items
          where owner_id = p_owner_id
            and manifest_id = p_manifest_id
        )
      )
  where owner_id = p_owner_id
    and id = p_manifest_id
  returning * into result;

  delete from public.memory_import_chunks
  where owner_id = p_owner_id
    and manifest_id = p_manifest_id;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 22. RPC: prepare completion (plan 5.5 small database-time op). Issued only
--     for the prepared manifest, bounded at four unexpired unused permits, and
--     bound to owner/manifest/generation/expected authority version.
-- ---------------------------------------------------------------------------
create or replace function public.memory_prepare_source_completion_v1(
  p_deployment_id text,
  p_writer_epoch bigint,
  p_writer_lease_id uuid,
  p_writer_lease_token text,
  p_source_credential_fingerprint text,
  p_owner_id uuid,
  p_session_id uuid,
  p_manifest_id text,
  p_expected_authority_version bigint
) returns public.memory_import_completion_permits
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.memory_import_completion_permits%rowtype;
  manifest public.memory_import_manifests%rowtype;
  owner_state public.memory_owner_state%rowtype;
begin
  perform public.memory_assert_writer(
    p_deployment_id, p_writer_epoch, p_writer_lease_id,
    p_writer_lease_token, p_source_credential_fingerprint
  );
  perform public.memory_assert_mirror_owner_access(p_owner_id, p_session_id);

  select *
  into owner_state
  from public.memory_owner_state
  where owner_id = p_owner_id
  for update;
  if owner_state.authority_version is distinct from p_expected_authority_version then
    raise exception using errcode = 'PT409', message = 'MIRROR_AUTHORITY_VERSION_STALE';
  end if;

  select *
  into manifest
  from public.memory_import_manifests
  where owner_id = p_owner_id
    and id = p_manifest_id
  for update;
  if not found or manifest.status <> 'prepared' then
    raise exception using errcode = 'PT409', message = 'MIRROR_MANIFEST_NOT_PREPARED';
  end if;

  delete from public.memory_import_completion_permits
  where owner_id = p_owner_id
    and expires_at <= clock_timestamp()
    and consumed_at is null;
  if (
    select count(*)
    from public.memory_import_completion_permits
    where owner_id = p_owner_id
      and expires_at > clock_timestamp()
      and consumed_at is null
  ) >= 4 then
    raise exception using errcode = 'P0001', message = 'MIRROR_COMPLETION_PERMIT_LIMIT';
  end if;

  insert into public.memory_import_completion_permits (
    owner_id, manifest_id, import_generation, expected_authority_version, expires_at
  ) values (
    p_owner_id, p_manifest_id, manifest.import_generation,
    p_expected_authority_version, clock_timestamp() + interval '8 seconds'
  )
  on conflict (owner_id, manifest_id, import_generation) do nothing
  returning * into result;

  if not found then
    select *
    into result
    from public.memory_import_completion_permits
    where owner_id = p_owner_id
      and manifest_id = p_manifest_id
      and import_generation = manifest.import_generation
    for update;
    if result.consumed_at is not null then
      raise exception using errcode = 'PT409', message = 'MIRROR_COMPLETION_PERMIT_CONSUMED';
    end if;
    if result.expires_at <= clock_timestamp() then
      delete from public.memory_import_completion_permits where id = result.id;
      insert into public.memory_import_completion_permits (
        owner_id, manifest_id, import_generation, expected_authority_version, expires_at
      ) values (
        p_owner_id, p_manifest_id, manifest.import_generation,
        p_expected_authority_version, clock_timestamp() + interval '8 seconds'
      )
      returning * into result;
    end if;
  end if;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 23. RPC: complete (plan 5.5). One transaction: consume the permit, recheck
--     revision CAS and accepted tombstones for every touched stable ID, apply
--     the accepted mutation set to the cumulative owner union, atomically
--     advance the owner-current-source-set, transition LOCAL -> MIRROR exactly
--     once, record the receipt, and compact the import membership.
-- ---------------------------------------------------------------------------
create or replace function public.memory_complete_source_import_v1(
  p_deployment_id text,
  p_writer_epoch bigint,
  p_writer_lease_id uuid,
  p_writer_lease_token text,
  p_source_credential_fingerprint text,
  p_owner_id uuid,
  p_session_id uuid,
  p_manifest_id text,
  p_permit_id uuid,
  p_expected_authority_version bigint,
  p_prepared_hash text,
  p_membership_hash text
) returns public.memory_import_manifests
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.memory_import_manifests%rowtype;
  manifest public.memory_import_manifests%rowtype;
  owner_state public.memory_owner_state%rowtype;
  permit public.memory_import_completion_permits%rowtype;
  item public.memory_import_items%rowtype;
  payload jsonb;
  updated_owner public.memory_owner_state%rowtype;
begin
  perform public.memory_assert_writer(
    p_deployment_id, p_writer_epoch, p_writer_lease_id,
    p_writer_lease_token, p_source_credential_fingerprint
  );
  perform public.memory_assert_mirror_owner_access(p_owner_id, p_session_id);

  select *
  into owner_state
  from public.memory_owner_state
  where owner_id = p_owner_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'MIRROR_ENROLLMENT_REQUIRED';
  end if;

  select *
  into manifest
  from public.memory_import_manifests
  where owner_id = p_owner_id
    and id = p_manifest_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'MIRROR_MANIFEST_NOT_FOUND';
  end if;

  -- Already verified: an identical retry returns the stored receipt even if the
  -- old permit is consumed/expired; changed input conflicts and never re-promotes.
  if manifest.status = 'verified' then
    if manifest.prepared_hash is distinct from p_prepared_hash
        or manifest.prepared_membership_hash is distinct from p_membership_hash
        or manifest.completion_authority_version is distinct from p_expected_authority_version then
      raise exception using errcode = 'PT409', message = 'MEMORY_IDEMPOTENCY_CONFLICT';
    end if;
    return manifest;
  end if;
  if manifest.status <> 'prepared' then
    raise exception using errcode = 'PT409', message = 'MIRROR_MANIFEST_NOT_PREPARED';
  end if;
  if owner_state.authority_version is distinct from p_expected_authority_version then
    raise exception using errcode = 'PT409', message = 'MIRROR_AUTHORITY_VERSION_STALE';
  end if;
  if manifest.prepared_hash is distinct from p_prepared_hash
      or manifest.prepared_membership_hash is distinct from p_membership_hash then
    raise exception using errcode = 'PT409', message = 'MIRROR_COMPLETION_MISMATCH';
  end if;

  select *
  into permit
  from public.memory_import_completion_permits
  where id = p_permit_id
    and owner_id = p_owner_id
    and manifest_id = p_manifest_id
    and import_generation = manifest.import_generation
    and expected_authority_version = p_expected_authority_version
  for update;
  if not found or permit.consumed_at is not null
      or permit.expires_at <= clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'MIRROR_COMPLETION_PERMIT_INVALID';
  end if;

  -- Stable identity locking prevents a same-owner manifest from observing a
  -- half-applied source set.
  perform 1
  from public.memory_conversations
  where owner_id = p_owner_id
    and id in (
      select conversation_id
      from public.memory_import_items
      where owner_id = p_owner_id and manifest_id = p_manifest_id
    )
  order by id
  for update;
  perform 1
  from public.memory_messages
  where owner_id = p_owner_id
    and id in (
      select stable_id
      from public.memory_import_items
      where owner_id = p_owner_id
        and manifest_id = p_manifest_id
        and item_kind = 'message'
    )
  order by id
  for update;

  if permit.expires_at <= clock_timestamp() + interval '3 seconds' then
    raise exception using errcode = 'P0001', message = 'MIRROR_COMPLETION_PERMIT_TOO_LATE';
  end if;

  -- Collision-safe two-step sequence reorder: move every touched message above
  -- this owner's current maximum, then restore exact sequences from payload.
  update public.memory_messages as message
  set sequence = ceiling.maximum_sequence + numbered.ordinal
  from (
    select coalesce(max(sequence), 0) as maximum_sequence
    from public.memory_messages
    where owner_id = p_owner_id
  ) as ceiling,
  (
    select stable_id, row_number() over (order by stable_id)::integer as ordinal
    from public.memory_import_items
    where owner_id = p_owner_id
      and manifest_id = p_manifest_id
      and item_kind = 'message'
  ) as numbered
  where message.owner_id = p_owner_id
    and message.id = numbered.stable_id;

  for item in
    select *
    from public.memory_import_items
    where owner_id = p_owner_id
      and manifest_id = p_manifest_id
      and item_kind = 'conversation'
    order by stable_id
    for update
  loop
    payload := item.payload;
    if exists (
      select 1
      from public.memory_deletion_ledger deletion
      where deletion.owner_id = p_owner_id
        and deletion.source_kind = payload->>'sourceKind'
        and deletion.source_id = payload->>'sourceRecordId'
        and deletion.source_revision >= item.observed_revision
    ) then
      raise exception using errcode = 'PT409', message = 'MIRROR_TOMBSTONE_DOMINATES';
    end if;
    if exists (
      select 1
      from public.memory_conversations current_row
      where current_row.owner_id = p_owner_id
        and current_row.id = item.stable_id
        and current_row.source_revision > item.observed_revision
    ) then
      raise exception using errcode = 'PT409', message = 'MIRROR_REVISION_CONFLICT';
    end if;
    update public.memory_conversations
    set source_kind = payload->>'sourceKind',
        source_record_id = payload->>'sourceRecordId',
        status = payload->>'status',
        started_at = (payload->>'startedAt')::timestamptz,
        settled_at = nullif(payload->>'settledAt', '')::timestamptz,
        timezone = nullif(payload->>'timezone', ''),
        week_starts_on = nullif(payload->>'weekStartsOn', '')::smallint,
        temporal_provenance = payload->>'temporalProvenance',
        client_schema_version = (payload->>'clientSchemaVersion')::integer,
        source_hash = item.canonical_hash,
        source_revision = item.observed_revision,
        previous_accepted_revision = nullif(payload->>'previousAcceptedRevision', '')::integer,
        eligibility = 'eligible',
        current_source_manifest_id = p_manifest_id,
        updated_at = clock_timestamp()
    where owner_id = p_owner_id
      and id = item.stable_id;
    update public.memory_conversation_revisions
    set eligibility = 'eligible'
    where owner_id = p_owner_id
      and conversation_id = item.stable_id
      and source_revision = item.observed_revision
      and manifest_id = p_manifest_id;
  end loop;

  for item in
    select *
    from public.memory_import_items
    where owner_id = p_owner_id
      and manifest_id = p_manifest_id
      and item_kind = 'message'
    order by stable_id
    for update
  loop
    payload := item.payload;
    if exists (
      select 1
      from public.memory_messages current_row
      where current_row.owner_id = p_owner_id
        and current_row.id = item.stable_id
        and current_row.source_revision > item.observed_revision
    ) then
      raise exception using errcode = 'PT409', message = 'MIRROR_REVISION_CONFLICT';
    end if;
    -- Refuse an inconsistent current view: the exact restored sequence must not
    -- collide with a retained eligible message in the same conversation.
    if exists (
      select 1
      from public.memory_messages other
      where other.owner_id = p_owner_id
        and other.conversation_id = payload->>'conversationId'
        and other.sequence = (payload->>'sequence')::integer
        and other.eligibility = 'eligible'
        and other.id <> item.stable_id
    ) then
      raise exception using errcode = 'PT409', message = 'MIRROR_SEQUENCE_CONFLICT';
    end if;
    update public.memory_messages
    set conversation_id = payload->>'conversationId',
        client_event_id = payload->>'clientEventId',
        role = payload->>'role',
        sequence = (payload->>'sequence')::integer,
        authored_at = (payload->>'authoredAt')::timestamptz,
        authored_timezone = nullif(payload->>'authoredTimezone', ''),
        local_date = nullif(payload->>'localDate', '')::date,
        temporal_provenance = payload->>'temporalProvenance',
        content = payload->>'content',
        content_hash = item.canonical_hash,
        revision = item.observed_revision,
        source_revision = item.observed_revision,
        previous_accepted_revision = nullif(payload->>'previousAcceptedRevision', '')::integer,
        status = payload->>'status',
        eligibility = 'eligible',
        current_source_manifest_id = p_manifest_id,
        updated_at = clock_timestamp()
    where owner_id = p_owner_id
      and id = item.stable_id;
    update public.memory_message_revisions
    set eligibility = 'eligible'
    where owner_id = p_owner_id
      and message_id = item.stable_id
      and revision = item.observed_revision
      and manifest_id = p_manifest_id;
  end loop;

  update public.memory_import_completion_permits
  set consumed_at = clock_timestamp()
  where id = permit.id;

  select *
  into updated_owner
  from public.memory_mirror_refresh_owner_union(p_owner_id, p_manifest_id);

  -- Finalization alone transitions LOCAL -> MIRROR with only cloudSourceMirroring.
  -- Already-MIRROR / SHADOW / CLOUD owners keep their state and flags exactly.
  if updated_owner.authority_state = 'LOCAL' then
    update public.memory_owner_state
    set authority_state = 'MIRROR',
        authority_version = authority_version + 1,
        feature_flags = jsonb_build_object(
          'cloudSourceMirroring', true,
          'cloudProjectionBuild', false,
          'shadowRetrieval', false,
          'cloudReadAuthority', false,
          'cloudWriteAuthority', false
        ),
        greatest_completed_generation = manifest.import_generation,
        updated_at = clock_timestamp()
    where owner_id = p_owner_id
    returning * into updated_owner;
  else
    update public.memory_owner_state
    set greatest_completed_generation = manifest.import_generation,
        updated_at = clock_timestamp()
    where owner_id = p_owner_id;
  end if;

  update public.memory_import_manifests
  set status = 'verified',
      verified_at = clock_timestamp(),
      completed_at = clock_timestamp(),
      completion_receipt = coalesce(completion_receipt,
        'mirror-complete:' || id || ':' || updated_owner.source_set_receipt
      ),
      completion_authority_version = updated_owner.authority_version,
      completion_source_set_version = updated_owner.source_set_version,
      completion_source_set_receipt = updated_owner.source_set_receipt,
      completion_source_set_conversation_count = updated_owner.source_set_conversation_count,
      completion_source_set_message_count = updated_owner.source_set_message_count,
      completion_source_set_hash = updated_owner.source_set_hash
  where owner_id = p_owner_id
    and id = p_manifest_id
  returning * into result;

  -- Compact the completed manifest's import membership after its accepted
  -- mutations are reflected in authoritative current rows.
  delete from public.memory_import_items
  where owner_id = p_owner_id
    and manifest_id = p_manifest_id;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 24. RPC: tombstone (plan 5.4). One transaction: content-equivalent
--     insert/replay of the deletion-ledger row, immediate eligibility removal
--     of matching conversations/revisions/messages/evidence spans, future-import
--     ineligibility, idempotent verify_deletion enqueue, and a stable tombstone
--     receipt carrying the original ineligibility counts plus the resulting
--     owner-union metadata (plan 5.4 effect 10).
-- ---------------------------------------------------------------------------
create or replace function public.memory_apply_source_tombstone_v1(
  p_deployment_id text,
  p_writer_epoch bigint,
  p_writer_lease_id uuid,
  p_writer_lease_token text,
  p_source_credential_fingerprint text,
  p_owner_id uuid,
  p_session_id uuid,
  p_source_kind text,
  p_source_id text,
  p_source_revision integer,
  p_previous_accepted_revision integer,
  p_client_event_id text,
  p_deleted_at timestamptz,
  p_reason_code text
) returns public.memory_deletion_ledger
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.memory_deletion_ledger%rowtype;
  current_conversation public.memory_conversations%rowtype;
  owner_result public.memory_owner_state%rowtype;
  v_ineligible_conversations integer := 0;
  v_ineligible_messages integer := 0;
begin
  perform public.memory_assert_writer(
    p_deployment_id, p_writer_epoch, p_writer_lease_id,
    p_writer_lease_token, p_source_credential_fingerprint
  );
  perform public.memory_assert_mirror_owner_access(p_owner_id, p_session_id);

  perform 1
  from public.memory_owner_state
  where owner_id = p_owner_id
  for update;

  select *
  into result
  from public.memory_deletion_ledger
  where owner_id = p_owner_id
    and client_event_id = p_client_event_id
  for update;
  if found then
    if result.source_kind is distinct from p_source_kind
        or result.source_id is distinct from p_source_id
        or result.source_revision is distinct from p_source_revision
        or result.deleted_at is distinct from p_deleted_at
        or result.reason_code is distinct from p_reason_code then
      raise exception using errcode = 'PT409', message = 'MEMORY_IDEMPOTENCY_CONFLICT';
    end if;
    return result;
  end if;

  select *
  into current_conversation
  from public.memory_conversations
  where owner_id = p_owner_id
    and source_kind = p_source_kind
    and source_record_id = p_source_id
  for update;

  if found then
    if p_source_revision <= current_conversation.source_revision
        or p_previous_accepted_revision is distinct from current_conversation.source_revision then
      raise exception using errcode = 'PT409', message = 'MIRROR_REVISION_CONFLICT';
    end if;
  elsif p_previous_accepted_revision is not null then
    -- A first-observed tombstone must name no predecessor (plan 5.4).
    raise exception using errcode = 'PT409', message = 'MIRROR_REVISION_CONFLICT';
  end if;

  insert into public.memory_deletion_ledger (
    owner_id, source_kind, source_id, source_revision,
    client_event_id, deleted_at, reason_code
  ) values (
    p_owner_id, p_source_kind, p_source_id, p_source_revision,
    p_client_event_id, p_deleted_at, p_reason_code
  )
  on conflict (owner_id, client_event_id) do nothing
  returning * into result;
  if not found then
    raise exception using errcode = 'PT409', message = 'MEMORY_IDEMPOTENCY_CONFLICT';
  end if;

  -- Original ineligibility counts: the eligible conversation/message rows this
  -- tombstone de-eligibilizes, measured BEFORE the sweeps below (plan 5.4
  -- effect 10). A first-observed tombstone sees zero rows.
  select count(*)
  into v_ineligible_conversations
  from public.memory_conversations
  where owner_id = p_owner_id
    and source_kind = p_source_kind
    and source_record_id = p_source_id
    and eligibility = 'eligible';

  select count(*)
  into v_ineligible_messages
  from public.memory_messages
  where owner_id = p_owner_id
    and conversation_id = current_conversation.id
    and eligibility = 'eligible';

  -- Immediate cloud ineligibility on accepted tombstone.
  update public.memory_conversations
  set status = 'deleted',
      eligibility = 'deleted',
      deleted_at = p_deleted_at,
      source_revision = greatest(source_revision, p_source_revision),
      updated_at = clock_timestamp()
  where owner_id = p_owner_id
    and source_kind = p_source_kind
    and source_record_id = p_source_id;
  update public.memory_conversation_revisions
  set eligibility = 'deleted'
  where owner_id = p_owner_id
    and conversation_id = current_conversation.id;
  update public.memory_messages
  set status = 'deleted',
      eligibility = 'deleted',
      deleted_at = p_deleted_at,
      updated_at = clock_timestamp()
  where owner_id = p_owner_id
    and conversation_id = current_conversation.id;
  update public.memory_message_revisions
  set eligibility = 'deleted'
  where owner_id = p_owner_id
    and conversation_id = current_conversation.id;
  -- Plan 5.4 effect 6 also covers evidence spans: every evidence span linked to
  -- a tombstoned message revision becomes 'deleted' in the same transaction.
  update public.memory_evidence_spans
  set eligibility = 'deleted'
  where owner_id = p_owner_id
    and message_revision_id in (
      select revision.id
      from public.memory_message_revisions revision
      where revision.owner_id = p_owner_id
        and revision.conversation_id = current_conversation.id
    );

  perform public.memory_enqueue_job(
    p_deployment_id, p_writer_epoch, p_writer_lease_id,
    p_writer_lease_token, p_source_credential_fingerprint,
    p_owner_id, 'verify_deletion', 'mirror-deletion:' || p_client_event_id,
    p_source_revision::text,
    jsonb_build_object(
      'sourceKind', p_source_kind,
      'sourceId', p_source_id,
      'sourceRevision', p_source_revision
    ),
    10, 5
  );

  select *
  into owner_result
  from public.memory_mirror_refresh_owner_union(
    p_owner_id, 'tombstone:' || p_client_event_id
  );

  update public.memory_deletion_ledger
  set mirror_receipt = 'mirror-tombstone:' || p_client_event_id
      || ':ineligible:c' || v_ineligible_conversations
      || ':m' || v_ineligible_messages
      || ':' || owner_result.source_set_receipt,
      mirror_ineligible_conversation_count = v_ineligible_conversations,
      mirror_ineligible_message_count = v_ineligible_messages,
      mirror_source_set_version = owner_result.source_set_version,
      mirror_source_set_receipt = owner_result.source_set_receipt,
      mirror_source_set_conversation_count = owner_result.source_set_conversation_count,
      mirror_source_set_message_count = owner_result.source_set_message_count,
      mirror_source_set_hash = owner_result.source_set_hash
  where id = result.id
  returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 25. RPC: parity (read, session-fenced). Returns the owner-current-source-set
--     contract resolved from eligible current rows.
-- ---------------------------------------------------------------------------
create or replace function public.memory_get_source_parity_v1(
  p_owner_id uuid,
  p_session_id uuid
) returns table (
  authority_state text,
  authority_version bigint,
  source_set_version bigint,
  source_set_receipt text,
  conversation_count integer,
  message_count integer,
  source_set_hash text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.memory_assert_mirror_owner_access(p_owner_id, p_session_id);
  return query
    select state.authority_state,
           state.authority_version,
           state.source_set_version,
           state.source_set_receipt,
           state.source_set_conversation_count,
           state.source_set_message_count,
           state.source_set_hash
    from public.memory_owner_state state
    where state.owner_id = p_owner_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 26. Provider-neutral function fencing: only the intended run role may invoke
--     a Phase 1 RPC. The Supabase overlay applies the per-role revocation and
--     the service-role-only grant.
-- ---------------------------------------------------------------------------
revoke all on function public.memory_enroll_mirror_v1(
  text, bigint, uuid, text, text, uuid, uuid, uuid
) from public;
revoke all on function public.memory_reserve_mirror_request_v1(
  text, bigint, uuid, text, text, uuid, uuid
) from public;
revoke all on function public.memory_begin_source_import_v1(
  text, bigint, uuid, text, text, uuid, uuid, text, uuid, integer, bigint, integer, integer, integer, text
) from public;
revoke all on function public.memory_accept_source_chunk_v1(
  text, bigint, uuid, text, text, uuid, uuid, text, integer, jsonb, text
) from public;
revoke all on function public.memory_get_source_import_v1(
  uuid, uuid, text
) from public;
revoke all on function public.memory_cancel_source_import_v1(
  text, bigint, uuid, text, text, uuid, uuid, text
) from public;
revoke all on function public.memory_validate_source_import_v1(
  text, bigint, uuid, text, text, uuid, uuid, text
) from public;
revoke all on function public.memory_prepare_source_completion_v1(
  text, bigint, uuid, text, text, uuid, uuid, text, bigint
) from public;
revoke all on function public.memory_complete_source_import_v1(
  text, bigint, uuid, text, text, uuid, uuid, text, uuid, bigint, text, text
) from public;
revoke all on function public.memory_apply_source_tombstone_v1(
  text, bigint, uuid, text, text, uuid, uuid, text, text, integer, integer, text, timestamptz, text
) from public;
revoke all on function public.memory_get_source_parity_v1(
  uuid, uuid
) from public;
revoke all on function public.memory_deterministic_json_hash(jsonb) from public;
revoke all on function public.memory_canonical_mirror_chunk(jsonb) from public;
revoke all on function public.memory_canonical_mirror_chunk_hash(jsonb) from public;
revoke all on function public.memory_assert_mirror_owner_access(uuid, uuid) from public;
revoke all on function public.memory_assert_mirror_revision(integer, integer, integer, boolean) from public;
revoke all on function public.memory_mirror_refresh_owner_union(uuid, text) from public;
