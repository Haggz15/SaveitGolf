-- Run this once in the Supabase SQL editor for your project.
-- Creates the profiles table used by the Sign Up / Profile Setup flow and
-- locks it down with row-level security so users can only write their own row.

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  username text unique,
  full_name text,
  home_state text,
  handicap_index numeric,
  created_at timestamptz not null default now()
);

-- Existing installations created the column as `handicap`; rename it in place
-- so the app's handicap_index field matches without losing any data.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'handicap'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'handicap_index'
  ) then
    alter table public.profiles rename column handicap to handicap_index;
  end if;
end $$;

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = user_id);
