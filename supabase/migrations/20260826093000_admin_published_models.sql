-- Task 6: published-model allowlist for the OmniRoute admin plane.
-- Additive migration; free models only are stored here.
create table if not exists control.admin_published_models (
  model_id text primary key,
  label text not null
);

alter table control.admin_published_models enable row level security;
