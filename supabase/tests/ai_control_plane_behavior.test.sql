begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, created_at, updated_at) values
  ('10000000-0000-4000-8000-000000000001', 'control-a@test.dev', now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'control-b@test.dev', now(), now()),
  ('10000000-0000-4000-8000-000000000003', 'control-admin@test.dev', now(), now())
on conflict (id) do nothing;

set local role anon;
select extensions.throws_ok(
  $$select * from public.ai_catalog_models$$,
  '42501', null,
  'anonymous catalog reads are denied by grants'
);
select extensions.throws_ok(
  $$select * from public.user_ai_preferences$$,
  '42501', null,
  'anonymous preference reads are denied by grants'
);
reset role;

set local role service_role;
select extensions.lives_ok($sql$
  insert into control.providers (
    id, name, protocol, base_url, display_metadata, discovery_config
  ) values (
    '20000000-0000-4000-8000-000000000001',
    'Test OpenAI',
    'openai-chat-completions',
    'https://models.test.example/v1',
    '{"label":"Test OpenAI"}',
    '{"modelsPath":"/models"}'
  )
$sql$, 'service role can create a provider');
select extensions.throws_ok($sql$
  insert into control.providers (name, protocol, base_url)
  values ('Bad Protocol', 'not-a-protocol', 'https://bad.test.example')
$sql$, '22P02', null, 'provider protocol enum rejects unsupported adapters');
select extensions.lives_ok($sql$
  insert into control.provider_credentials (
    provider_id, ciphertext, nonce, authentication_tag, key_version, label, last_four
  ) values (
    '20000000-0000-4000-8000-000000000001',
    decode('aabbcc', 'hex'), decode('00112233445566778899aabb', 'hex'),
    decode('00112233445566778899aabbccddeeff', 'hex'), 1, 'primary', 't123'
  )
$sql$, 'service role can store envelope-encrypted credentials');
select extensions.lives_ok($sql$
  insert into control.provider_models (
    id, provider_id, upstream_model_id, label, capabilities, context_window
  ) values (
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'vendor/model-a', 'Model A',
    '{"streaming":true,"tools":true,"vision":false,"jsonObject":true,"jsonSchema":false}',
    65536
  ), (
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'vendor/model-b', 'Model B',
    '{"streaming":true,"tools":false,"vision":false,"jsonObject":true,"jsonSchema":false}',
    32768
  )
$sql$, 'service role can store discovered models');
select extensions.throws_ok($sql$
  insert into control.provider_models (
    provider_id, upstream_model_id, label, capabilities
  ) values (
    '20000000-0000-4000-8000-000000000001',
    'vendor/incomplete', 'Incomplete', '{"streaming":true}'
  )
$sql$, '23514', null, 'capability checks reject incomplete public capability metadata');
select extensions.lives_ok($sql$
  insert into control.admins (user_id, role)
  values ('10000000-0000-4000-8000-000000000003', 'admin')
$sql$, 'service role can maintain the explicit admin allowlist');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select extensions.throws_ok(
  $$select * from control.providers$$,
  '42501', null,
  'an authenticated admin still cannot read the private schema directly'
);
select extensions.throws_ok($sql$
  select control.publish_catalog_model(
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    1,
    'Model A', 'managed/model-a',
    '{"streaming":true,"tools":true,"vision":false,"jsonObject":true,"jsonSchema":false}',
    65536, 10, 'chat'
  )
$sql$, '42501', null, 'authenticated users cannot call admin mutation functions');
reset role;

set local role service_role;
select extensions.throws_ok($sql$
  select control.publish_catalog_model(
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    0,
    'Model A', 'managed/model-a',
    '{"streaming":true,"tools":true,"vision":false,"jsonObject":true,"jsonSchema":false}',
    65536, 10, 'chat'
  )
$sql$, 'PT409', 'REVISION_CONFLICT', 'stale provider publication revision conflicts');
select extensions.is(
  (select count(*) from public.ai_catalog_models),
  0::bigint,
  'failed publication leaves no partial catalog row'
);
select extensions.is(
  (select revision from public.ai_catalog_revision where singleton),
  0::bigint,
  'failed publication does not advance catalog revision'
);
select extensions.lives_ok($sql$
  select control.publish_catalog_model(
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    1,
    'Model A', 'managed/model-a',
    '{"streaming":true,"tools":true,"vision":false,"jsonObject":true,"jsonSchema":false}',
    65536, 10, 'chat'
  )
$sql$, 'service role publishes catalog and route transactionally');
select extensions.is(
  (select revision from public.ai_catalog_revision where singleton),
  1::bigint,
  'successful publication advances the singleton revision once'
);
select extensions.is(
  (select state::text from control.model_routes limit 1),
  'active',
  'publication creates an active private route'
);
select extensions.throws_ok($sql$
  update control.runtime_settings
  set active_flash_route_id = (select id from control.model_routes limit 1)
  where singleton
$sql$, '23514', 'ACTIVE_FLASH_ROUTE_INVALID', 'runtime flash selection rejects a public chat route');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select extensions.is(
  (select public_model_id from public.ai_catalog_models),
  'managed/model-a',
  'authenticated clients can read the safe catalog'
);
select extensions.lives_ok($sql$
  insert into public.user_ai_preferences (user_id, selected_model_id)
  select '10000000-0000-4000-8000-000000000001', id
  from public.ai_catalog_models where public_model_id = 'managed/model-a'
$sql$, 'user A can select an available catalog model');
select extensions.throws_ok($sql$
  insert into public.user_ai_preferences (user_id, selected_model_id)
  select '10000000-0000-4000-8000-000000000002', id
  from public.ai_catalog_models where public_model_id = 'managed/model-a'
$sql$, '42501', null, 'user A cannot create user B preference');
select extensions.is(
  (select count(*) from public.user_ai_preferences),
  1::bigint,
  'user A sees only its own preference'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select extensions.is(
  (select count(*) from public.user_ai_preferences),
  0::bigint,
  'user B cannot read user A preference'
);
select extensions.lives_ok($sql$
  update public.user_ai_preferences set updated_at = clock_timestamp()
$sql$, 'user B update attempt is safely filtered by RLS');
select extensions.lives_ok($sql$
  insert into public.user_ai_preferences (user_id, selected_model_id)
  select '10000000-0000-4000-8000-000000000002', id
  from public.ai_catalog_models where public_model_id = 'managed/model-a'
$sql$, 'user B can create only its own preference');
reset role;

set local role service_role;
select extensions.is(
  (select revision from public.user_ai_preferences where user_id = '10000000-0000-4000-8000-000000000001'),
  1::bigint, 'user B could not update user A preference'
);
select extensions.throws_ok($sql$
  select control.archive_catalog_model(
    (select id from public.ai_catalog_models where public_model_id = 'managed/model-a'),
    0
  )
$sql$, 'PT409', 'REVISION_CONFLICT', 'stale catalog archive revision conflicts');
select extensions.lives_ok($sql$
  select control.archive_catalog_model(
    (select id from public.ai_catalog_models where public_model_id = 'managed/model-a'),
    1
  )
$sql$, 'service role archives a public model transactionally');
select extensions.is(
  (select availability from public.ai_catalog_models where public_model_id = 'managed/model-a'),
  'unavailable',
  'archive withdraws the catalog model without deleting it'
);
select extensions.is(
  (select state::text from control.model_routes limit 1),
  'disabled',
  'archive disables dependent routes'
);
select extensions.is(
  (select revision from public.ai_catalog_revision where singleton),
  2::bigint,
  'archive advances the catalog revision once'
);
select extensions.is(
  (select count(*) from public.user_ai_preferences),
  2::bigint,
  'withdrawal preserves existing explicit user selections'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select extensions.throws_ok($sql$
  update public.user_ai_preferences
  set selected_model_id = (
    select id from public.ai_catalog_models where public_model_id = 'managed/model-a'
  )
  where user_id = '10000000-0000-4000-8000-000000000001'
$sql$, '23514', 'AI_CATALOG_MODEL_UNAVAILABLE', 'users cannot newly select a withdrawn model');
reset role;

set local role service_role;
select extensions.lives_ok($sql$
  select control.publish_catalog_model(
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    2,
    'Model A', 'managed/model-a',
    '{"streaming":true,"tools":true,"vision":false,"jsonObject":true,"jsonSchema":false}',
    65536, 10, 'chat'
  )
$sql$, 'an archived catalog model can be explicitly republished');
select extensions.throws_ok($sql$
  select control.archive_provider_model('30000000-0000-4000-8000-000000000001', 0)
$sql$, 'PT409', 'REVISION_CONFLICT', 'stale provider-model archive revision conflicts');
select extensions.lives_ok($sql$
  select control.archive_provider_model('30000000-0000-4000-8000-000000000001', 1)
$sql$, 'service role archives a provider model and dependent catalog atomically');
select extensions.is(
  (select state::text from control.provider_models where id = '30000000-0000-4000-8000-000000000001'),
  'archived',
  'provider-model archive preserves the inventory row'
);
select extensions.is(
  (select availability from public.ai_catalog_models where public_model_id = 'managed/model-a'),
  'unavailable',
  'provider-model archive withdraws its public model'
);
select extensions.lives_ok($sql$
  select control.publish_catalog_model(
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002', 3,
    'Model B', 'managed/model-b',
    '{"streaming":true,"tools":false,"vision":false,"jsonObject":true,"jsonSchema":false}',
    32768, 20, 'chat'
  )
$sql$, 'a second model is published before provider withdrawal');
select extensions.throws_ok($sql$
  select control.archive_provider('20000000-0000-4000-8000-000000000001', 3)
$sql$, 'PT409', 'REVISION_CONFLICT', 'stale provider archive revision conflicts');
select extensions.lives_ok($sql$
  select control.archive_provider('20000000-0000-4000-8000-000000000001', 4)
$sql$, 'service role archives a provider and dependent catalog atomically');
select extensions.is(
  (select state::text from control.providers where id = '20000000-0000-4000-8000-000000000001'),
  'archived',
  'provider archive preserves the historical provider row'
);
select extensions.is(
  (select availability from public.ai_catalog_models where public_model_id = 'managed/model-b'),
  'unavailable',
  'provider archive withdraws dependent public models'
);
select extensions.is(
  (select revision from public.ai_catalog_revision where singleton),
  6::bigint,
  'each successful publish and archive advances catalog revision exactly once'
);
reset role;

select * from extensions.finish();
rollback;
