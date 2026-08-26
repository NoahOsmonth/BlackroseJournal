-- Preserve why a route was disabled so only automatic control-plane
-- suspensions are automatically restored later.
alter table control.model_routes
  add column suspension_reason text
  check (suspension_reason is null or (
    state = 'disabled' and suspension_reason in ('provider', 'provider_model')
  ));

create function control.normalize_route_suspension()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.state <> 'disabled' then
    new.suspension_reason := null;
  end if;
  return new;
end;
$function$;

create trigger model_routes_normalize_suspension
before insert or update of state, suspension_reason on control.model_routes
for each row execute function control.normalize_route_suspension();

create function control.update_provider(
  p_provider_id uuid,
  p_expected_revision bigint,
  p_patch jsonb
)
returns control.providers
language plpgsql
set search_path = ''
as $function$
declare
  v_provider control.providers%rowtype;
  v_catalog_ids uuid[];
  v_next_state control.provider_state;
  v_changed integer := 0;
begin
  if jsonb_typeof(p_patch) <> 'object'
    or p_patch - array[
      'name', 'base_url', 'state', 'display_metadata', 'discovery_config'
    ]::text[] <> '{}'::jsonb then
    raise exception using errcode = '23514', message = 'PROVIDER_PATCH_INVALID';
  end if;

  perform revision
  from public.ai_catalog_revision
  where singleton
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'CATALOG_REVISION_NOT_FOUND';
  end if;

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
    raise exception using errcode = '23514', message = 'PROVIDER_ARCHIVED';
  end if;

  v_next_state := case
    when p_patch ? 'state' then (p_patch ->> 'state')::control.provider_state
    else v_provider.state
  end;
  if v_next_state = 'archived' then
    raise exception using errcode = '23514', message = 'PROVIDER_ARCHIVE_REQUIRES_ARCHIVE_RPC';
  end if;

  perform model.id
  from control.provider_models model
  where model.provider_id = p_provider_id
  order by model.id
  for update;

  select coalesce(array_agg(distinct route.catalog_model_id), array[]::uuid[])
  into v_catalog_ids
  from control.model_routes route
  join control.provider_models model on model.id = route.provider_model_id
  where model.provider_id = p_provider_id
    and route.catalog_model_id is not null;

  perform catalog.id
  from public.ai_catalog_models catalog
  where catalog.id = any(v_catalog_ids)
  order by catalog.id
  for update;

  update control.providers
  set name = case when p_patch ? 'name' then p_patch ->> 'name' else name end,
      base_url = case when p_patch ? 'base_url' then p_patch ->> 'base_url' else base_url end,
      state = v_next_state,
      display_metadata = case
        when p_patch ? 'display_metadata' then p_patch -> 'display_metadata'
        else display_metadata
      end,
      discovery_config = case
        when p_patch ? 'discovery_config' then p_patch -> 'discovery_config'
        else discovery_config
      end
  where id = p_provider_id
  returning * into v_provider;

  if v_provider.state = 'disabled' then
    update control.model_routes route
    set state = 'disabled', suspension_reason = 'provider'
    where route.state = 'active'
      and exists (
        select 1 from control.provider_models model
        where model.id = route.provider_model_id
          and model.provider_id = p_provider_id
      );
  elsif v_provider.state = 'active' then
    update control.model_routes route
    set state = 'active', suspension_reason = null
    where route.state = 'disabled'
      and route.suspension_reason = 'provider'
      and exists (
        select 1 from control.provider_models model
        where model.id = route.provider_model_id
          and model.provider_id = p_provider_id
          and model.state = 'active'
      );
  end if;

  update public.ai_catalog_models catalog
  set availability = case
    when exists (
      select 1
      from control.model_routes route
      join control.provider_models model on model.id = route.provider_model_id
      join control.providers provider on provider.id = model.provider_id
      where route.catalog_model_id = catalog.id
        and route.purpose = 'chat'
        and route.state = 'active'
        and model.state = 'active'
        and provider.state = 'active'
    ) then 'available'
    else 'unavailable'
  end
  where catalog.id = any(v_catalog_ids)
    and catalog.availability is distinct from case
      when exists (
        select 1
        from control.model_routes route
        join control.provider_models model on model.id = route.provider_model_id
        join control.providers provider on provider.id = model.provider_id
        where route.catalog_model_id = catalog.id
          and route.purpose = 'chat'
          and route.state = 'active'
          and model.state = 'active'
          and provider.state = 'active'
      ) then 'available'
      else 'unavailable'
    end;
  get diagnostics v_changed = row_count;

  if v_changed > 0 then
    perform control.bump_catalog_revision();
  end if;
  return v_provider;
end;
$function$;

create function control.replace_discovered_models(
  p_provider_id uuid,
  p_expected_provider_revision bigint,
  p_models jsonb
)
returns setof control.provider_models
language plpgsql
set search_path = ''
as $function$
declare
  v_provider control.providers%rowtype;
  v_catalog_ids uuid[];
  v_changed integer := 0;
begin
  if jsonb_typeof(p_models) <> 'array' then
    raise exception using errcode = '23514', message = 'PROVIDER_MODELS_INVALID';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_models) as item(upstream_model_id text)
    group by item.upstream_model_id
    having item.upstream_model_id is null or count(*) > 1
  ) then
    raise exception using errcode = '23514', message = 'PROVIDER_MODELS_INVALID';
  end if;

  perform revision
  from public.ai_catalog_revision
  where singleton
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'CATALOG_REVISION_NOT_FOUND';
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

  perform model.id
  from control.provider_models model
  where model.provider_id = p_provider_id
  order by model.id
  for update;

  select coalesce(array_agg(distinct route.catalog_model_id), array[]::uuid[])
  into v_catalog_ids
  from control.model_routes route
  join control.provider_models model on model.id = route.provider_model_id
  where model.provider_id = p_provider_id
    and route.catalog_model_id is not null;

  perform catalog.id
  from public.ai_catalog_models catalog
  where catalog.id = any(v_catalog_ids)
  order by catalog.id
  for update;

  insert into control.provider_models (
    provider_id, upstream_model_id, label, capabilities, context_window,
    raw_safe_metadata, state, discovered_at
  )
  select
    p_provider_id, item.upstream_model_id, item.label, item.capabilities,
    item.context_window, coalesce(item.raw_safe_metadata, '{}'::jsonb),
    'active', clock_timestamp()
  from jsonb_to_recordset(p_models) as item(
    upstream_model_id text,
    label text,
    capabilities jsonb,
    context_window integer,
    raw_safe_metadata jsonb
  )
  on conflict (provider_id, upstream_model_id)
  do update set
    label = excluded.label,
    capabilities = excluded.capabilities,
    context_window = excluded.context_window,
    raw_safe_metadata = excluded.raw_safe_metadata,
    state = 'active',
    discovered_at = excluded.discovered_at;

  update control.provider_models model
  set state = 'disabled'
  where model.provider_id = p_provider_id
    and model.state = 'active'
    and not exists (
      select 1
      from jsonb_to_recordset(p_models) as item(upstream_model_id text)
      where item.upstream_model_id = model.upstream_model_id
    );

  update control.model_routes route
  set state = 'disabled', suspension_reason = 'provider_model'
  where route.state = 'active'
    and exists (
      select 1 from control.provider_models model
      where model.id = route.provider_model_id
        and model.provider_id = p_provider_id
        and model.state <> 'active'
    );

  update control.model_routes route
  set state = 'active', suspension_reason = null
  where route.state = 'disabled'
    and route.suspension_reason = 'provider_model'
    and exists (
      select 1 from control.provider_models model
      where model.id = route.provider_model_id
        and model.provider_id = p_provider_id
        and model.state = 'active'
    );

  update public.ai_catalog_models catalog
  set availability = case
    when exists (
      select 1
      from control.model_routes route
      join control.provider_models model on model.id = route.provider_model_id
      join control.providers provider on provider.id = model.provider_id
      where route.catalog_model_id = catalog.id
        and route.purpose = 'chat'
        and route.state = 'active'
        and model.state = 'active'
        and provider.state = 'active'
    ) then 'available'
    else 'unavailable'
  end
  where catalog.id = any(v_catalog_ids)
    and catalog.availability is distinct from case
      when exists (
        select 1
        from control.model_routes route
        join control.provider_models model on model.id = route.provider_model_id
        join control.providers provider on provider.id = model.provider_id
        where route.catalog_model_id = catalog.id
          and route.purpose = 'chat'
          and route.state = 'active'
          and model.state = 'active'
          and provider.state = 'active'
      ) then 'available'
      else 'unavailable'
    end;
  get diagnostics v_changed = row_count;

  update control.providers
  set updated_at = clock_timestamp()
  where id = p_provider_id;

  if v_changed > 0 then
    perform control.bump_catalog_revision();
  end if;

  return query
  select model.*
  from control.provider_models model
  where model.provider_id = p_provider_id
  order by model.label, model.id;
end;
$function$;

revoke all on function control.normalize_route_suspension() from public, anon, authenticated;
revoke all on function control.update_provider(uuid, bigint, jsonb)
  from public, anon, authenticated;
revoke all on function control.replace_discovered_models(uuid, bigint, jsonb)
  from public, anon, authenticated;
grant execute on function control.update_provider(uuid, bigint, jsonb) to service_role;
grant execute on function control.replace_discovered_models(uuid, bigint, jsonb) to service_role;
