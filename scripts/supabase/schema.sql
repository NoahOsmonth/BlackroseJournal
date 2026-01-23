-- Supabase schema for JournalApp
-- Apply in Supabase SQL editor

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger as $$
begin
    if new.updated_at is null or new.updated_at = old.updated_at then
        new.updated_at = now();
    end if;
    return new;
end;
$$ language plpgsql;

create table if not exists public.journal_entries (
    id text primary key,
    owner_id uuid not null default auth.uid(),
    title text,
    emoji text,
    status text check (status in ('draft','completed')),
    messages jsonb not null,
    word_count integer,
    message_count integer,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.weekly_insights (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null default auth.uid(),
    week_key text not null,
    insights jsonb not null,
    entry_count integer not null default 0,
    cached_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (owner_id, week_key)
);

create table if not exists public.happiness_recipe_items (
    id text primary key,
    owner_id uuid not null default auth.uid(),
    type text not null,
    text text not null,
    completed boolean not null default false,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
    owner_id uuid primary key default auth.uid(),
    theme text,
    emoji_style text,
    updated_at timestamptz not null default now()
);

create index if not exists journal_entries_owner_updated_idx
    on public.journal_entries (owner_id, updated_at desc);

create index if not exists journal_entries_owner_status_idx
    on public.journal_entries (owner_id, status);

create index if not exists weekly_insights_owner_week_idx
    on public.weekly_insights (owner_id, week_key);

create index if not exists happiness_recipe_owner_updated_idx
    on public.happiness_recipe_items (owner_id, updated_at desc);

create trigger journal_entries_set_updated_at
before update on public.journal_entries
for each row execute procedure public.set_updated_at();

create trigger weekly_insights_set_updated_at
before update on public.weekly_insights
for each row execute procedure public.set_updated_at();

create trigger happiness_recipe_set_updated_at
before update on public.happiness_recipe_items
for each row execute procedure public.set_updated_at();

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute procedure public.set_updated_at();

alter table public.journal_entries enable row level security;
alter table public.weekly_insights enable row level security;
alter table public.happiness_recipe_items enable row level security;
alter table public.user_settings enable row level security;

create policy "Journal entries are private" on public.journal_entries
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Weekly insights are private" on public.weekly_insights
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Recipe items are private" on public.happiness_recipe_items
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "User settings are private" on public.user_settings
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
