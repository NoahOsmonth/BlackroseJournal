begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, created_at, updated_at) values
  ('11000000-0000-4000-8000-000000000001', 'review-user@test.dev', now(), now())
on conflict (id) do nothing;

set local role service_role;
insert into control.providers (id, name, protocol, base_url) values
  ('21000000-0000-4000-8000-000000000001', 'Review Provider A',
   'openai-chat-completions', 'https://provider-a.test.example/v1'),
  ('21000000-0000-4000-8000-000000000002', 'Review Provider B',
   'openai-chat-completions', 'https://provider-b.test.example/v1');
insert into control.provider_models (
  id, provider_id, upstream_model_id, label, capabilities, context_window
) values
  ('31000000-0000-4000-8000-000000000001',
   '21000000-0000-4000-8000-000000000001', 'vendor/shared', 'Shared A',
   '{"streaming":true,"tools":true,"vision":false,"jsonObject":true,"jsonSchema":false}',
   65536),
  ('31000000-0000-4000-8000-000000000002',
   '21000000-0000-4000-8000-000000000002', 'vendor/shared', 'Shared B',
   '{"streaming":true,"tools":true,"vision":false,"jsonObject":true,"jsonSchema":false}',
   65536),
  ('31000000-0000-4000-8000-000000000003',
   '21000000-0000-4000-8000-000000000001', 'vendor/flash', 'Flash A',
   '{"streaming":false,"tools":false,"vision":false,"jsonObject":true,"jsonSchema":true}',
   32768),
  ('31000000-0000-4000-8000-000000000005',
   '21000000-0000-4000-8000-000000000001', 'vendor/unrelated', 'Unrelated A',
   '{"streaming":true,"tools":false,"vision":false,"jsonObject":true,"jsonSchema":false}',
   32768);

select extensions.lives_ok($sql$
  select control.publish_catalog_model(
    '21000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000001',
    1, 0,
    'Shared Model A', 'managed/shared',
    '{"streaming":true,"tools":true,"vision":false,"jsonObject":true,"jsonSchema":false}',
    65536, 10, 'chat'
  )
$sql$, 'new catalog publication accepts the current singleton revision');

select extensions.throws_ok($sql$
  select control.publish_catalog_model(
    '21000000-0000-4000-8000-000000000002',
    '31000000-0000-4000-8000-000000000002',
    1, 0,
    'Stale Cross-provider Label', 'managed/shared',
    '{"streaming":true,"tools":true,"vision":false,"jsonObject":true,"jsonSchema":false}',
    65536, 20, 'chat'
  )
$sql$, 'PT409', 'REVISION_CONFLICT',
  'cross-provider stale overwrite conflicts on locked catalog revision');
select extensions.is(
  (select label from public.ai_catalog_models where public_model_id = 'managed/shared'),
  'Shared Model A',
  'stale cross-provider publication cannot overwrite catalog metadata'
);
select extensions.is(
  (select count(*) from control.model_routes where state = 'active'),
  1::bigint,
  'stale cross-provider publication cannot replace the active route'
);

select extensions.lives_ok($sql$
  select control.publish_catalog_model(
    '21000000-0000-4000-8000-000000000002',
    '31000000-0000-4000-8000-000000000002',
    1, 1,
    'Shared Model B', 'managed/shared',
    '{"streaming":true,"tools":true,"vision":false,"jsonObject":true,"jsonSchema":false}',
    65536, 20, 'chat'
  )
$sql$, 'matching catalog revision permits an explicit cross-provider route change');

select extensions.lives_ok($sql$
  select control.publish_catalog_model(
    '21000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000005',
    2, 2,
    'Unrelated Model', 'managed/unrelated',
    '{"streaming":true,"tools":false,"vision":false,"jsonObject":true,"jsonSchema":false}',
    32768, 30, 'chat'
  )
$sql$, 'unrelated publication advances the singleton catalog revision');
select extensions.throws_ok($sql$
  select control.publish_catalog_model(
    '21000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000001',
    3, 2,
    'Stale After Unrelated', 'managed/shared',
    '{"streaming":true,"tools":true,"vision":false,"jsonObject":true,"jsonSchema":false}',
    65536, 10, 'chat'
  )
$sql$, 'PT409', 'REVISION_CONFLICT',
  'unrelated catalog change invalidates stale singleton revision on unchanged row');
select extensions.lives_ok($sql$
  select control.publish_catalog_model(
    '21000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000001',
    3, 3,
    'Shared Model Current', 'managed/shared',
    '{"streaming":true,"tools":true,"vision":false,"jsonObject":true,"jsonSchema":false}',
    65536, 10, 'chat'
  )
$sql$, 'current singleton revision updates an otherwise unchanged catalog row');
select extensions.ok(
  (select model.revision = catalog.revision
   from public.ai_catalog_models model cross join public.ai_catalog_revision catalog
   where model.public_model_id = 'managed/shared' and catalog.singleton),
  'published row revision equals the resulting singleton catalog revision'
);
select extensions.throws_ok($sql$
  select control.publish_catalog_model(
    '21000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000001',
    4, null,
    'Null New', 'managed/new-conflict',
    '{"streaming":true,"tools":true,"vision":false,"jsonObject":true,"jsonSchema":false}',
    65536, 40, 'chat'
  )
$sql$, 'PT409', 'REVISION_CONFLICT', 'null expected revision on new publication is typed conflict');
select extensions.throws_ok($sql$
  select control.publish_catalog_model(
    '21000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000001',
    4, 3,
    'Stale New', 'managed/new-conflict',
    '{"streaming":true,"tools":true,"vision":false,"jsonObject":true,"jsonSchema":false}',
    65536, 40, 'chat'
  )
$sql$, 'PT409', 'REVISION_CONFLICT', 'stale competing new publication is typed conflict');
select extensions.is(
  (select count(*) from public.ai_catalog_models where public_model_id = 'managed/new-conflict'),
  0::bigint,
  'typed new-publication conflicts leave no partial row'
);
update control.model_routes
set state = 'active'
where provider_model_id = '31000000-0000-4000-8000-000000000002';

select extensions.lives_ok($sql$
  select control.archive_provider_model('31000000-0000-4000-8000-000000000002', 1)
$sql$, 'provider-model archive succeeds with an alternate active chat route');
select extensions.is(
  (select availability from public.ai_catalog_models where public_model_id = 'managed/shared'),
  'available',
  'provider-model archive keeps catalog available when another active chat route remains'
);
select extensions.is(
  (select revision from public.ai_catalog_revision where singleton),
  4::bigint,
  'provider-model archive without public withdrawal does not bump catalog revision'
);

insert into control.model_routes (
  id, provider_model_id, purpose, state, priority
) values (
  '41000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000003', 'flash', 'active', 0
);
update control.runtime_settings
set active_flash_route_id = '41000000-0000-4000-8000-000000000001'
where singleton;
update control.model_routes
set state = 'disabled'
where id = '41000000-0000-4000-8000-000000000001';
select extensions.is(
  (select active_flash_route_id from control.runtime_settings where singleton),
  null::uuid,
  'disabling the selected flash route transactionally clears runtime selection'
);

update control.model_routes
set state = 'active'
where id = '41000000-0000-4000-8000-000000000001';
update control.runtime_settings
set active_flash_route_id = '41000000-0000-4000-8000-000000000001'
where singleton;
select extensions.lives_ok($sql$
  select control.archive_provider_model('31000000-0000-4000-8000-000000000003', 1)
$sql$, 'archiving the selected flash model succeeds transactionally');
select extensions.is(
  (select active_flash_route_id from control.runtime_settings where singleton),
  null::uuid,
  'archiving the selected flash model clears runtime selection'
);

insert into control.provider_models (
  id, provider_id, upstream_model_id, label, capabilities, context_window
) values (
  '31000000-0000-4000-8000-000000000004',
  '21000000-0000-4000-8000-000000000002', 'vendor/alternate', 'Alternate B',
  '{"streaming":true,"tools":false,"vision":false,"jsonObject":true,"jsonSchema":false}',
  32768
);
insert into control.model_routes (catalog_model_id, provider_model_id, purpose, state)
select id, '31000000-0000-4000-8000-000000000004', 'chat', 'active'
from public.ai_catalog_models where public_model_id = 'managed/shared';
select extensions.lives_ok($sql$
  select control.archive_provider('21000000-0000-4000-8000-000000000002', 2)
$sql$, 'provider archive succeeds with another provider route active');
select extensions.is(
  (select availability from public.ai_catalog_models where public_model_id = 'managed/shared'),
  'available',
  'provider archive keeps catalog available while another active chat route remains'
);
select extensions.is(
  (select state::text from control.model_routes
   where provider_model_id = '31000000-0000-4000-8000-000000000001'),
  'active',
  'provider archive does not mutate another provider active route'
);
reset role;

select extensions.ok(
  has_column_privilege('authenticated', 'public.user_ai_preferences', 'selected_model_id', 'INSERT')
    and has_column_privilege('authenticated', 'public.user_ai_preferences', 'selected_model_id', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.user_ai_preferences', 'user_id', 'INSERT')
    and not has_column_privilege('authenticated', 'public.user_ai_preferences', 'user_id', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.user_ai_preferences', 'revision', 'INSERT')
    and not has_column_privilege('authenticated', 'public.user_ai_preferences', 'revision', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.user_ai_preferences', 'created_at', 'INSERT')
    and not has_column_privilege('authenticated', 'public.user_ai_preferences', 'created_at', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.user_ai_preferences', 'updated_at', 'INSERT')
    and not has_column_privilege('authenticated', 'public.user_ai_preferences', 'updated_at', 'UPDATE'),
  'authenticated preference writes expose only selected_model_id'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);
select extensions.lives_ok($sql$
  insert into public.user_ai_preferences (selected_model_id)
  select id from public.ai_catalog_models where public_model_id = 'managed/shared'
$sql$, 'preference insert derives user and metadata server-side');
select extensions.is(
  (select revision from public.user_ai_preferences),
  1::bigint,
  'new preference starts at server-owned revision one'
);
select extensions.throws_ok(
  $$update public.user_ai_preferences set revision = 99$$,
  '42501', null,
  'authenticated user cannot set preference revision'
);
select extensions.throws_ok(
  $$update public.user_ai_preferences set created_at = '2000-01-01Z'$$,
  '42501', null,
  'authenticated user cannot set preference creation timestamp'
);
select extensions.throws_ok(
  $$update public.user_ai_preferences set updated_at = '2000-01-01Z'$$,
  '42501', null,
  'authenticated user cannot set preference update timestamp'
);
reset role;

select extensions.is(
  (
    select count(*)
    from pg_proc function
    join pg_namespace namespace on namespace.oid = function.pronamespace
    where namespace.nspname = 'control'
      and has_function_privilege('service_role', function.oid, 'EXECUTE')
  ),
  7::bigint,
  'gateway function catalog has the expected service-only surface'
);
select extensions.ok(
  (
    select bool_and(function.proconfig @> array['search_path=""'])
    from pg_proc function
    join pg_namespace namespace on namespace.oid = function.pronamespace
    where namespace.nspname = 'control'
      and has_function_privilege('service_role', function.oid, 'EXECUTE')
  ),
  'every gateway function pins an empty search_path'
);
select extensions.ok(
  (
    select bool_and(
      not has_function_privilege('public', function.oid, 'EXECUTE')
      and not has_function_privilege('anon', function.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', function.oid, 'EXECUTE')
    )
    from pg_proc function
    join pg_namespace namespace on namespace.oid = function.pronamespace
    where namespace.nspname = 'control'
      and has_function_privilege('service_role', function.oid, 'EXECUTE')
  ),
  'PUBLIC and client roles cannot execute any gateway function'
);

select * from extensions.finish();
rollback;
