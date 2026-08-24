begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(5);

select extensions.ok(
  strpos(definition, 'from public.ai_catalog_revision') > 0
    and strpos(definition, 'from public.ai_catalog_revision')
      < strpos(definition, 'from control.providers')
    and strpos(definition, 'from control.providers')
      < strpos(definition, 'from control.provider_models')
    and strpos(definition, 'from control.provider_models')
      < strpos(definition, 'from public.ai_catalog_models'),
  'publish locks singleton, provider, provider model, then catalog model'
)
from (
  select lower(pg_get_functiondef(
    'control.publish_catalog_model(uuid,uuid,bigint,bigint,text,text,jsonb,integer,integer,text)'::regprocedure
  )) as definition
) as publish_definition;

select extensions.ok(
  strpos(definition, 'from public.ai_catalog_revision') > 0
    and strpos(definition, 'from public.ai_catalog_revision')
      < strpos(definition, 'from control.providers')
    and strpos(definition, 'from control.providers')
      < strpos(definition, 'from control.provider_models'),
  'provider-model archive locks singleton, provider, then provider model'
)
from (
  select lower(pg_get_functiondef(
    'control.archive_provider_model(uuid,bigint)'::regprocedure
  )) as definition
) as provider_model_definition;

select extensions.ok(
  strpos(definition, 'from public.ai_catalog_revision') > 0
    and strpos(definition, 'from public.ai_catalog_revision')
      < strpos(definition, 'from control.providers'),
  'provider archive locks singleton before provider state'
)
from (
  select lower(pg_get_functiondef(
    'control.archive_provider(uuid,bigint)'::regprocedure
  )) as definition
) as provider_definition;

select extensions.ok(
  strpos(definition, 'from public.ai_catalog_revision') > 0
    and strpos(definition, 'from public.ai_catalog_revision')
      < strpos(definition, 'from public.ai_catalog_models'),
  'catalog archive locks singleton before catalog state'
)
from (
  select lower(pg_get_functiondef(
    'control.archive_catalog_model(uuid,bigint)'::regprocedure
  )) as definition
) as catalog_definition;

select extensions.ok(
  strpos(definition, 'update public.ai_catalog_revision') > 0
    and strpos(definition, 'control.providers') = 0
    and strpos(definition, 'control.provider_models') = 0
    and strpos(definition, 'public.ai_catalog_models') = 0,
  'catalog revision bump touches no downstream catalog relation'
)
from (
  select lower(pg_get_functiondef(
    'control.bump_catalog_revision()'::regprocedure
  )) as definition
) as bump_definition;

select * from extensions.finish();
rollback;
