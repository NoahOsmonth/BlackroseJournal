begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, created_at, updated_at) values
  ('19000000-0000-4000-8000-000000000001', 'disable-sync@test.dev', now(), now())
on conflict (id) do nothing;

set local role service_role;
insert into control.providers (id, name, protocol, base_url) values (
  '29000000-0000-4000-8000-000000000001', 'Disable Sync Provider',
  'openai-chat-completions', 'https://disable-sync.test.example/v1'
);
insert into control.provider_models (
  id, provider_id, upstream_model_id, label, capabilities, context_window
) values (
  '39000000-0000-4000-8000-000000000001',
  '29000000-0000-4000-8000-000000000001', 'vendor/disable-sync', 'Disable Sync',
  '{"streaming":true,"tools":true,"vision":false,"jsonObject":true,"jsonSchema":false}',
  65536
);

select control.publish_catalog_model(
  '29000000-0000-4000-8000-000000000001',
  '39000000-0000-4000-8000-000000000001',
  1, 0, 'Disable Sync', 'managed/disable-sync',
  '{"streaming":true,"tools":true,"vision":false,"jsonObject":true,"jsonSchema":false}',
  65536, 10, 'chat'
);

select extensions.lives_ok($sql$
  select control.update_provider(
    '29000000-0000-4000-8000-000000000001', 2, '{"state":"disabled"}'::jsonb
  )
$sql$, 'provider disable is one transactional control-plane mutation');
select extensions.is(
  (select state::text from control.model_routes where provider_model_id =
    '39000000-0000-4000-8000-000000000001'),
  'disabled', 'provider disable withdraws its active route'
);
select extensions.is(
  (select availability from public.ai_catalog_models where public_model_id =
    'managed/disable-sync'),
  'unavailable', 'provider disable withdraws its public catalog model'
);
select extensions.is(
  (select revision from public.ai_catalog_revision where singleton),
  2::bigint, 'provider disable advances the realtime catalog revision once'
);

select extensions.lives_ok($sql$
  select control.update_provider(
    '29000000-0000-4000-8000-000000000001', 3, '{"state":"active"}'::jsonb
  )
$sql$, 'provider re-enable restores only its suspended routes');
select extensions.is(
  (select state::text from control.model_routes where provider_model_id =
    '39000000-0000-4000-8000-000000000001'),
  'active', 'provider re-enable restores the suspended route'
);
select extensions.is(
  (select availability from public.ai_catalog_models where public_model_id =
    'managed/disable-sync'),
  'available', 'provider re-enable restores public catalog availability'
);
select extensions.is(
  (select revision from public.ai_catalog_revision where singleton),
  3::bigint, 'provider re-enable advances the realtime catalog revision once'
);

select extensions.lives_ok($sql$
  select * from control.replace_discovered_models(
    '29000000-0000-4000-8000-000000000001', 4, '[]'::jsonb
  )
$sql$, 'empty discovery transactionally disables stale inventory');
select extensions.is(
  (select state::text from control.provider_models where id =
    '39000000-0000-4000-8000-000000000001'),
  'disabled', 'stale discovery disables the provider model'
);
select extensions.is(
  (select state::text from control.model_routes where provider_model_id =
    '39000000-0000-4000-8000-000000000001'),
  'disabled', 'stale discovery withdraws the active route'
);
select extensions.is(
  (select availability from public.ai_catalog_models where public_model_id =
    'managed/disable-sync'),
  'unavailable', 'stale discovery withdraws catalog availability'
);
select extensions.is(
  (select revision from public.ai_catalog_revision where singleton),
  4::bigint, 'stale discovery advances the realtime catalog revision once'
);

select extensions.lives_ok($sql$
  select * from control.replace_discovered_models(
    '29000000-0000-4000-8000-000000000001', 5,
    '[{"upstream_model_id":"vendor/disable-sync","label":"Disable Sync","capabilities":{"streaming":true,"tools":true,"vision":false,"jsonObject":true,"jsonSchema":false},"context_window":65536,"raw_safe_metadata":{}}]'::jsonb
  )
$sql$, 'rediscovery transactionally restores stale inventory');
select extensions.is(
  (select state::text from control.model_routes where provider_model_id =
    '39000000-0000-4000-8000-000000000001'),
  'active', 'rediscovery restores only the discovery-suspended route'
);
select extensions.is(
  (select availability from public.ai_catalog_models where public_model_id =
    'managed/disable-sync'),
  'available', 'rediscovery restores catalog availability'
);
select extensions.is(
  (select revision from public.ai_catalog_revision where singleton),
  5::bigint, 'rediscovery advances the realtime catalog revision once'
);

select * from extensions.finish();
rollback;
