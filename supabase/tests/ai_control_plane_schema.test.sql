begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.has_schema('control', 'private control schema exists');

select extensions.has_table('public', 'ai_catalog_models', 'catalog table exists');
select extensions.has_table('public', 'ai_catalog_revision', 'catalog revision table exists');
select extensions.has_table('public', 'user_ai_preferences', 'preference table exists');

select extensions.has_table('control', 'providers', 'providers table is private');
select extensions.has_table('control', 'provider_credentials', 'credentials table is private');
select extensions.has_table('control', 'provider_models', 'provider inventory is private');
select extensions.has_table('control', 'model_routes', 'routes table is private');
select extensions.has_table('control', 'runtime_settings', 'runtime settings are private');
select extensions.has_table('control', 'admins', 'admin allowlist is private');
select extensions.has_table('control', 'audit_events', 'audit events are private');
select extensions.has_table('control', 'usage_events', 'usage events are private');
select extensions.has_table('control', 'rekey_jobs', 'rekey jobs are private');
select extensions.has_function(
  'control', 'publish_catalog_model',
  array['uuid', 'uuid', 'bigint', 'text', 'text', 'jsonb', 'integer', 'integer', 'text'],
  'transactional publish function exists'
);
select extensions.has_function(
  'control', 'archive_catalog_model', array['uuid', 'bigint'],
  'transactional catalog archive function exists'
);
select extensions.has_function(
  'control', 'archive_provider_model', array['uuid', 'bigint'],
  'transactional provider-model archive function exists'
);
select extensions.has_function(
  'control', 'archive_provider', array['uuid', 'bigint'],
  'transactional provider archive function exists'
);
select extensions.has_index(
  'control', 'runtime_settings', 'runtime_settings_active_flash_route_idx',
  'runtime flash route foreign key is indexed'
);

select extensions.is(
  (
    select array_agg(column_name::text order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_catalog_models'
  ),
  array[
    'id', 'label', 'public_model_id', 'capabilities', 'context_window',
    'availability', 'sort_order', 'revision', 'created_at', 'updated_at'
  ]::text[],
  'public catalog exposes only the authenticated-safe contract'
);

select extensions.ok(
  coalesce((
    select not has_schema_privilege('anon', n.oid, 'USAGE')
      and not has_schema_privilege('authenticated', n.oid, 'USAGE')
    from pg_namespace n where n.nspname = 'control'
  ), false),
  'client roles have no control-schema usage'
);
select extensions.ok(
  coalesce((
    select has_schema_privilege('service_role', n.oid, 'USAGE')
    from pg_namespace n where n.nspname = 'control'
  ), false),
  'service role can use the control schema'
);

select extensions.ok(
  coalesce((
    select bool_and(not has_table_privilege('anon', c.oid, 'SELECT'))
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('ai_catalog_models', 'ai_catalog_revision', 'user_ai_preferences')
    having count(*) = 3
  ), false),
  'anonymous role has no AI control-plane table grants'
);
select extensions.ok(
  coalesce((
    select
      has_table_privilege('authenticated', m.oid, 'SELECT')
      and not has_table_privilege('authenticated', m.oid, 'INSERT')
      and not has_table_privilege('authenticated', m.oid, 'UPDATE')
      and has_table_privilege('authenticated', r.oid, 'SELECT')
      and has_table_privilege('authenticated', p.oid, 'SELECT')
      and has_table_privilege('authenticated', p.oid, 'INSERT')
      and has_table_privilege('authenticated', p.oid, 'UPDATE')
      and not has_table_privilege('authenticated', p.oid, 'DELETE')
    from pg_class m
    join pg_namespace mn on mn.oid = m.relnamespace and mn.nspname = 'public'
    join pg_class r on r.relname = 'ai_catalog_revision'
    join pg_namespace rn on rn.oid = r.relnamespace and rn.nspname = 'public'
    join pg_class p on p.relname = 'user_ai_preferences'
    join pg_namespace pn on pn.oid = p.relnamespace and pn.nspname = 'public'
    where m.relname = 'ai_catalog_models'
  ), false),
  'authenticated grants are least-privilege'
);

select extensions.ok(
  (
    select bool_and(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('ai_catalog_models', 'ai_catalog_revision', 'user_ai_preferences')
  ),
  'all exposed AI tables have RLS enabled'
);
select extensions.ok(
  (
    select bool_and(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'control'
      and c.relkind = 'r'
  ),
  'private control tables have defense-in-depth RLS'
);
select extensions.is(
  (
    select count(*)
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'control' and t.typtype = 'e'
  ),
  8::bigint,
  'control lifecycle and protocol domains use database enums'
);

select extensions.is(
  (
    select array_agg(schemaname || '.' || tablename order by schemaname, tablename)
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and (
        schemaname = 'control'
        or tablename in ('ai_catalog_models', 'ai_catalog_revision', 'user_ai_preferences')
      )
  ),
  array['public.ai_catalog_models', 'public.ai_catalog_revision']::text[],
  'Realtime publishes only catalog data, never preferences or control data'
);

select * from extensions.finish();
rollback;
