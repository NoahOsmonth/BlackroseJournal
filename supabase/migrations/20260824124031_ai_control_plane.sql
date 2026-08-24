-- Authenticated-safe managed model catalog plus a private gateway control plane.
-- This migration is intentionally additive and portable across Supabase-managed
-- and Supabase self-hosted Postgres deployments.

create schema control;
revoke all on schema control from public, anon, authenticated;
grant usage on schema control to service_role;

create type control.provider_protocol as enum (
  'openai-chat-completions',
  'openai-responses',
  'anthropic-messages',
  'gemini-generate-content'
);
create type control.provider_state as enum ('active', 'disabled', 'archived');
create type control.provider_model_state as enum ('active', 'disabled', 'archived');
create type control.route_purpose as enum ('chat', 'flash');
create type control.route_state as enum ('active', 'disabled', 'archived');
create type control.admin_role as enum ('owner', 'admin', 'auditor');
create type control.usage_status as enum ('succeeded', 'failed', 'cancelled');
create type control.rekey_status as enum ('pending', 'running', 'completed', 'failed');

create table public.ai_catalog_models (
  id uuid primary key default gen_random_uuid(),
  label text not null check (length(label) between 1 and 120),
  public_model_id text not null unique check (length(public_model_id) between 1 and 240),
  capabilities jsonb not null,
  context_window integer not null check (context_window > 0),
  availability text not null default 'available'
    check (availability in ('available', 'degraded', 'unavailable')),
  sort_order integer not null default 0 check (sort_order >= 0),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint ai_catalog_models_capabilities_check check (
    jsonb_typeof(capabilities) = 'object'
    and capabilities ?& array['streaming', 'tools', 'vision', 'jsonObject', 'jsonSchema']
    and capabilities - array['streaming', 'tools', 'vision', 'jsonObject', 'jsonSchema']::text[] = '{}'::jsonb
    and jsonb_typeof(capabilities -> 'streaming') = 'boolean'
    and jsonb_typeof(capabilities -> 'tools') = 'boolean'
    and jsonb_typeof(capabilities -> 'vision') = 'boolean'
    and jsonb_typeof(capabilities -> 'jsonObject') = 'boolean'
    and jsonb_typeof(capabilities -> 'jsonSchema') = 'boolean'
  )
);

create index ai_catalog_models_listing_idx
  on public.ai_catalog_models (availability, sort_order, id);

create table public.ai_catalog_revision (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default clock_timestamp()
);

insert into public.ai_catalog_revision (singleton, revision) values (true, 0);

create table public.user_ai_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade
    default auth.uid(),
  selected_model_id uuid references public.ai_catalog_models(id) on delete restrict,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create index user_ai_preferences_selected_model_idx
  on public.user_ai_preferences (selected_model_id)
  where selected_model_id is not null;

create table control.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(name) between 1 and 120),
  protocol control.provider_protocol not null,
  base_url text not null check (length(base_url) between 1 and 2048),
  state control.provider_state not null default 'active',
  display_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(display_metadata) = 'object'),
  discovery_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(discovery_config) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  archived_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (
    (state = 'archived' and archived_at is not null)
    or (state <> 'archived' and archived_at is null)
  )
);

create index providers_state_idx on control.providers (state, updated_at desc);

create table control.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null unique
    references control.providers(id) on delete restrict,
  ciphertext bytea not null check (octet_length(ciphertext) > 0),
  nonce bytea not null check (octet_length(nonce) = 12),
  authentication_tag bytea not null check (octet_length(authentication_tag) = 16),
  key_version integer not null check (key_version > 0),
  label text check (label is null or length(label) between 1 and 120),
  last_four text check (last_four is null or length(last_four) = 4),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table control.provider_models (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references control.providers(id) on delete restrict,
  upstream_model_id text not null check (length(upstream_model_id) between 1 and 512),
  label text not null check (length(label) between 1 and 160),
  capabilities jsonb not null,
  context_window integer check (context_window is null or context_window > 0),
  raw_safe_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(raw_safe_metadata) = 'object'),
  state control.provider_model_state not null default 'active',
  revision bigint not null default 1 check (revision > 0),
  discovered_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (provider_id, upstream_model_id),
  constraint provider_models_capabilities_check check (
    jsonb_typeof(capabilities) = 'object'
    and capabilities ?& array['streaming', 'tools', 'vision', 'jsonObject', 'jsonSchema']
    and capabilities - array['streaming', 'tools', 'vision', 'jsonObject', 'jsonSchema']::text[] = '{}'::jsonb
    and jsonb_typeof(capabilities -> 'streaming') = 'boolean'
    and jsonb_typeof(capabilities -> 'tools') = 'boolean'
    and jsonb_typeof(capabilities -> 'vision') = 'boolean'
    and jsonb_typeof(capabilities -> 'jsonObject') = 'boolean'
    and jsonb_typeof(capabilities -> 'jsonSchema') = 'boolean'
  )
);

create index provider_models_state_idx
  on control.provider_models (provider_id, state, updated_at desc);

create table control.model_routes (
  id uuid primary key default gen_random_uuid(),
  catalog_model_id uuid references public.ai_catalog_models(id) on delete restrict,
  provider_model_id uuid not null references control.provider_models(id) on delete restrict,
  purpose control.route_purpose not null,
  state control.route_state not null default 'active',
  priority integer not null default 0 check (priority >= 0),
  max_input_bytes integer not null default 1048576 check (max_input_bytes > 0),
  max_output_tokens integer not null default 8192 check (max_output_tokens > 0),
  request_timeout_ms integer not null default 120000 check (request_timeout_ms > 0),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (catalog_model_id, provider_model_id, purpose),
  check (purpose = 'flash' or catalog_model_id is not null)
);

create index model_routes_catalog_idx
  on control.model_routes (catalog_model_id, state, priority)
  where catalog_model_id is not null;
create index model_routes_provider_model_idx
  on control.model_routes (provider_model_id, state, purpose, priority);
create index model_routes_active_purpose_idx
  on control.model_routes (purpose, priority, id)
  where state = 'active';

create table control.runtime_settings (
  singleton boolean primary key default true check (singleton),
  active_flash_route_id uuid references control.model_routes(id) on delete restrict,
  max_input_bytes integer not null default 1048576 check (max_input_bytes > 0),
  max_output_tokens integer not null default 8192 check (max_output_tokens > 0),
  request_timeout_ms integer not null default 120000 check (request_timeout_ms > 0),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default clock_timestamp()
);

insert into control.runtime_settings (singleton) values (true);

create index runtime_settings_active_flash_route_idx
  on control.runtime_settings (active_flash_route_id)
  where active_flash_route_id is not null;

create table control.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role control.admin_role not null,
  enabled boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create index admins_enabled_role_idx on control.admins (enabled, role, user_id);

create table control.audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (length(action) between 1 and 160),
  resource_type text not null check (length(resource_type) between 1 and 120),
  resource_id text check (resource_id is null or length(resource_id) between 1 and 512),
  before_metadata jsonb check (before_metadata is null or jsonb_typeof(before_metadata) = 'object'),
  after_metadata jsonb check (after_metadata is null or jsonb_typeof(after_metadata) = 'object'),
  created_at timestamptz not null default clock_timestamp()
);

create index audit_events_created_idx on control.audit_events (created_at desc, id desc);
create index audit_events_actor_idx
  on control.audit_events (actor_user_id, created_at desc)
  where actor_user_id is not null;
create index audit_events_resource_idx
  on control.audit_events (resource_type, resource_id, created_at desc);

create table control.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  route_id uuid references control.model_routes(id) on delete set null,
  status control.usage_status not null,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  error_code text check (error_code is null or length(error_code) between 1 and 120),
  created_at timestamptz not null default clock_timestamp()
);

create index usage_events_user_created_idx
  on control.usage_events (user_id, created_at desc)
  where user_id is not null;
create index usage_events_route_created_idx
  on control.usage_events (route_id, created_at desc)
  where route_id is not null;
create index usage_events_status_created_idx
  on control.usage_events (status, created_at desc);

create table control.rekey_jobs (
  id uuid primary key default gen_random_uuid(),
  from_key_version integer not null check (from_key_version > 0),
  to_key_version integer not null check (to_key_version > 0),
  status control.rekey_status not null default 'pending',
  last_credential_id uuid references control.provider_credentials(id) on delete restrict,
  processed_count integer not null default 0 check (processed_count >= 0),
  failure_count integer not null default 0 check (failure_count >= 0),
  error_metadata jsonb check (error_metadata is null or jsonb_typeof(error_metadata) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (from_key_version <> to_key_version),
  check ((status = 'completed' and completed_at is not null) or status <> 'completed')
);

create index rekey_jobs_status_created_idx
  on control.rekey_jobs (status, created_at, id);
create index rekey_jobs_cursor_idx
  on control.rekey_jobs (last_credential_id)
  where last_credential_id is not null;

create function control.bump_row_revision()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.revision := old.revision + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$function$;

create trigger ai_catalog_models_revision
before update on public.ai_catalog_models
for each row execute function control.bump_row_revision();
create trigger user_ai_preferences_revision
before update on public.user_ai_preferences
for each row execute function control.bump_row_revision();
create trigger providers_revision
before update on control.providers
for each row execute function control.bump_row_revision();
create trigger provider_models_revision
before update on control.provider_models
for each row execute function control.bump_row_revision();
create trigger model_routes_revision
before update on control.model_routes
for each row execute function control.bump_row_revision();
create trigger runtime_settings_revision
before update on control.runtime_settings
for each row execute function control.bump_row_revision();
create trigger rekey_jobs_revision
before update on control.rekey_jobs
for each row execute function control.bump_row_revision();

create function control.ensure_catalog_model_selectable()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.selected_model_id is not null and not exists (
    select 1
    from public.ai_catalog_models model
    where model.id = new.selected_model_id
      and model.availability = 'available'
  ) then
    raise exception using
      errcode = '23514',
      message = 'AI_CATALOG_MODEL_UNAVAILABLE';
  end if;
  return new;
end;
$function$;

create trigger user_ai_preferences_selectable_model
before insert or update of selected_model_id on public.user_ai_preferences
for each row execute function control.ensure_catalog_model_selectable();

create function control.ensure_active_flash_route()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.active_flash_route_id is not null and not exists (
    select 1
    from control.model_routes route
    where route.id = new.active_flash_route_id
      and route.purpose = 'flash'
      and route.state = 'active'
  ) then
    raise exception using
      errcode = '23514',
      message = 'ACTIVE_FLASH_ROUTE_INVALID';
  end if;
  return new;
end;
$function$;

create trigger runtime_settings_active_flash_route
before insert or update of active_flash_route_id on control.runtime_settings
for each row execute function control.ensure_active_flash_route();

create function control.bump_catalog_revision()
returns bigint
language plpgsql
set search_path = ''
as $function$
declare
  v_revision bigint;
begin
  update public.ai_catalog_revision
  set revision = revision + 1,
      updated_at = clock_timestamp()
  where singleton
  returning revision into strict v_revision;
  return v_revision;
end;
$function$;

create function control.publish_catalog_model(
  p_provider_id uuid,
  p_provider_model_id uuid,
  p_expected_provider_revision bigint,
  p_label text,
  p_public_model_id text,
  p_capabilities jsonb,
  p_context_window integer,
  p_sort_order integer,
  p_purpose text
)
returns public.ai_catalog_models
language plpgsql
set search_path = ''
as $function$
declare
  v_provider control.providers%rowtype;
  v_provider_model control.provider_models%rowtype;
  v_catalog public.ai_catalog_models%rowtype;
begin
  if p_purpose <> 'chat' then
    raise exception using errcode = '23514', message = 'PUBLIC_CATALOG_REQUIRES_CHAT_ROUTE';
  end if;

  select * into v_provider
  from control.providers
  where id = p_provider_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PROVIDER_NOT_FOUND';
  end if;
  if v_provider.revision <> p_expected_provider_revision then
    raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
  end if;
  if v_provider.state <> 'active' then
    raise exception using errcode = '23514', message = 'PROVIDER_UNAVAILABLE';
  end if;

  select * into v_provider_model
  from control.provider_models
  where id = p_provider_model_id
    and provider_id = p_provider_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PROVIDER_MODEL_NOT_FOUND';
  end if;
  if v_provider_model.state <> 'active' then
    raise exception using errcode = '23514', message = 'PROVIDER_MODEL_UNAVAILABLE';
  end if;

  select * into v_catalog
  from public.ai_catalog_models
  where public_model_id = p_public_model_id
  for update;

  if found then
    update public.ai_catalog_models
    set label = p_label,
        capabilities = p_capabilities,
        context_window = p_context_window,
        availability = 'available',
        sort_order = p_sort_order
    where id = v_catalog.id
    returning * into v_catalog;
  else
    insert into public.ai_catalog_models (
      label, public_model_id, capabilities, context_window, availability, sort_order
    ) values (
      p_label, p_public_model_id, p_capabilities, p_context_window, 'available', p_sort_order
    ) returning * into v_catalog;
  end if;

  update control.model_routes
  set state = 'disabled'
  where catalog_model_id = v_catalog.id
    and purpose = 'chat'
    and state = 'active';

  insert into control.model_routes (
    catalog_model_id, provider_model_id, purpose, state, priority
  ) values (
    v_catalog.id, p_provider_model_id, 'chat', 'active', 0
  )
  on conflict (catalog_model_id, provider_model_id, purpose)
  do update set state = 'active', priority = excluded.priority;

  update control.providers set updated_at = clock_timestamp() where id = p_provider_id;
  perform control.bump_catalog_revision();
  return v_catalog;
end;
$function$;

create function control.archive_catalog_model(
  p_catalog_model_id uuid,
  p_expected_revision bigint
)
returns public.ai_catalog_models
language plpgsql
set search_path = ''
as $function$
declare
  v_catalog public.ai_catalog_models%rowtype;
begin
  select * into v_catalog
  from public.ai_catalog_models
  where id = p_catalog_model_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'CATALOG_MODEL_NOT_FOUND';
  end if;
  if v_catalog.revision <> p_expected_revision then
    raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
  end if;
  if v_catalog.availability = 'unavailable' then
    return v_catalog;
  end if;

  update public.ai_catalog_models
  set availability = 'unavailable'
  where id = p_catalog_model_id
  returning * into v_catalog;

  update control.model_routes
  set state = 'disabled'
  where catalog_model_id = p_catalog_model_id
    and state = 'active';

  perform control.bump_catalog_revision();
  return v_catalog;
end;
$function$;

create function control.archive_provider(
  p_provider_id uuid,
  p_expected_revision bigint
)
returns control.providers
language plpgsql
set search_path = ''
as $function$
declare
  v_provider control.providers%rowtype;
  v_withdrawn integer;
begin
  select * into v_provider
  from control.providers
  where id = p_provider_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PROVIDER_NOT_FOUND';
  end if;
  if v_provider.revision <> p_expected_revision then
    raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
  end if;
  if v_provider.state = 'archived' then
    return v_provider;
  end if;

  update control.providers
  set state = 'archived', archived_at = clock_timestamp()
  where id = p_provider_id
  returning * into v_provider;

  update control.provider_models
  set state = 'archived'
  where provider_id = p_provider_id
    and state <> 'archived';

  update public.ai_catalog_models catalog
  set availability = 'unavailable'
  where catalog.availability <> 'unavailable'
    and exists (
      select 1
      from control.model_routes route
      join control.provider_models model on model.id = route.provider_model_id
      where route.catalog_model_id = catalog.id
        and model.provider_id = p_provider_id
    );
  get diagnostics v_withdrawn = row_count;

  update control.model_routes route
  set state = 'archived'
  where route.state <> 'archived'
    and exists (
      select 1 from control.provider_models model
      where model.id = route.provider_model_id
        and model.provider_id = p_provider_id
    );

  if v_withdrawn > 0 then
    perform control.bump_catalog_revision();
  end if;
  return v_provider;
end;
$function$;

create function control.archive_provider_model(
  p_provider_model_id uuid,
  p_expected_revision bigint
)
returns control.provider_models
language plpgsql
set search_path = ''
as $function$
declare
  v_provider_model control.provider_models%rowtype;
  v_withdrawn integer;
begin
  select * into v_provider_model
  from control.provider_models
  where id = p_provider_model_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PROVIDER_MODEL_NOT_FOUND';
  end if;
  if v_provider_model.revision <> p_expected_revision then
    raise exception using errcode = 'PT409', message = 'REVISION_CONFLICT';
  end if;
  if v_provider_model.state = 'archived' then
    return v_provider_model;
  end if;

  update control.provider_models
  set state = 'archived'
  where id = p_provider_model_id
  returning * into v_provider_model;

  update public.ai_catalog_models catalog
  set availability = 'unavailable'
  where catalog.availability <> 'unavailable'
    and exists (
      select 1 from control.model_routes route
      where route.catalog_model_id = catalog.id
        and route.provider_model_id = p_provider_model_id
    );
  get diagnostics v_withdrawn = row_count;

  update control.model_routes
  set state = 'archived'
  where provider_model_id = p_provider_model_id
    and state <> 'archived';

  if v_withdrawn > 0 then
    perform control.bump_catalog_revision();
  end if;
  return v_provider_model;
end;
$function$;

alter table public.ai_catalog_models enable row level security;
alter table public.ai_catalog_revision enable row level security;
alter table public.user_ai_preferences enable row level security;

create policy ai_catalog_models_authenticated_select
on public.ai_catalog_models for select to authenticated using (true);
create policy ai_catalog_revision_authenticated_select
on public.ai_catalog_revision for select to authenticated using (singleton);
create policy user_ai_preferences_own_select
on public.user_ai_preferences for select to authenticated
using ((select auth.uid()) = user_id);
create policy user_ai_preferences_own_insert
on public.user_ai_preferences for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy user_ai_preferences_own_update
on public.user_ai_preferences for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter table control.providers enable row level security;
alter table control.provider_credentials enable row level security;
alter table control.provider_models enable row level security;
alter table control.model_routes enable row level security;
alter table control.runtime_settings enable row level security;
alter table control.admins enable row level security;
alter table control.audit_events enable row level security;
alter table control.usage_events enable row level security;
alter table control.rekey_jobs enable row level security;

revoke all on table
  public.ai_catalog_models,
  public.ai_catalog_revision,
  public.user_ai_preferences
from public, anon, authenticated;

grant select on table
  public.ai_catalog_models,
  public.ai_catalog_revision
to authenticated;
grant select, insert, update on table public.user_ai_preferences to authenticated;
grant all on table
  public.ai_catalog_models,
  public.ai_catalog_revision,
  public.user_ai_preferences
to service_role;

revoke all on all tables in schema control from public, anon, authenticated;
revoke all on all sequences in schema control from public, anon, authenticated;
grant all on all tables in schema control to service_role;
grant all on all sequences in schema control to service_role;

revoke all on function control.bump_row_revision() from public, anon, authenticated;
revoke all on function control.ensure_catalog_model_selectable() from public, anon, authenticated;
revoke all on function control.ensure_active_flash_route() from public, anon, authenticated;
revoke all on function control.bump_catalog_revision() from public, anon, authenticated;
revoke all on function control.publish_catalog_model(
  uuid, uuid, bigint, text, text, jsonb, integer, integer, text
) from public, anon, authenticated;
revoke all on function control.archive_catalog_model(uuid, bigint)
  from public, anon, authenticated;
revoke all on function control.archive_provider_model(uuid, bigint)
  from public, anon, authenticated;
revoke all on function control.archive_provider(uuid, bigint)
  from public, anon, authenticated;

grant execute on function control.bump_catalog_revision() to service_role;
grant execute on function control.publish_catalog_model(
  uuid, uuid, bigint, text, text, jsonb, integer, integer, text
) to service_role;
grant execute on function control.archive_catalog_model(uuid, bigint) to service_role;
grant execute on function control.archive_provider_model(uuid, bigint) to service_role;
grant execute on function control.archive_provider(uuid, bigint) to service_role;

alter default privileges in schema control revoke all on tables from public, anon, authenticated;
alter default privileges in schema control revoke all on sequences from public, anon, authenticated;
alter default privileges in schema control revoke execute on functions from public, anon, authenticated;
alter default privileges in schema control grant all on tables to service_role;
alter default privileges in schema control grant all on sequences to service_role;

do $publication$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ai_catalog_models'
  ) then
    alter publication supabase_realtime add table public.ai_catalog_models;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ai_catalog_revision'
  ) then
    alter publication supabase_realtime add table public.ai_catalog_revision;
  end if;
end;
$publication$;
