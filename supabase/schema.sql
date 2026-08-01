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

-- Followers: one row per "A follows B" relationship.
create table if not exists public.followers (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint followers_no_self_follow check (follower_id <> following_id),
  constraint followers_unique unique (follower_id, following_id)
);

create index if not exists followers_follower_id_idx on public.followers (follower_id);
create index if not exists followers_following_id_idx on public.followers (following_id);

alter table public.followers enable row level security;

drop policy if exists "Follow relationships are viewable by everyone" on public.followers;
create policy "Follow relationships are viewable by everyone"
  on public.followers for select
  using (true);

drop policy if exists "Users can follow as themselves" on public.followers;
create policy "Users can follow as themselves"
  on public.followers for insert
  with check (auth.uid() = follower_id);

drop policy if exists "Users can unfollow their own follows" on public.followers;
create policy "Users can unfollow their own follows"
  on public.followers for delete
  using (auth.uid() = follower_id);

-- Friend requests: reserved for a future request/accept flow (the Add
-- Friends and profile Follow buttons currently follow directly, without
-- requiring acceptance).
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  constraint friend_requests_no_self_request check (requester_id <> recipient_id),
  constraint friend_requests_unique unique (requester_id, recipient_id)
);

alter table public.friend_requests enable row level security;

drop policy if exists "Users can view requests they sent or received" on public.friend_requests;
create policy "Users can view requests they sent or received"
  on public.friend_requests for select
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

drop policy if exists "Users can send requests as themselves" on public.friend_requests;
create policy "Users can send requests as themselves"
  on public.friend_requests for insert
  with check (auth.uid() = requester_id);

drop policy if exists "Recipients can respond to their requests" on public.friend_requests;
create policy "Recipients can respond to their requests"
  on public.friend_requests for update
  using (auth.uid() = recipient_id);

drop policy if exists "Requesters can cancel their own requests" on public.friend_requests;
create policy "Requesters can cancel their own requests"
  on public.friend_requests for delete
  using (auth.uid() = requester_id);

-- Posts: a hole photo/video shared to the feed.
-- user_id carries two FKs on purpose: auth.users for cascade-delete, and an
-- explicitly-named one to public.profiles(user_id) so PostgREST can embed
-- `profiles!posts_user_id_profiles_fkey(...)` to get the author's username.
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text,
  course_name text not null,
  city text,
  state text,
  lat double precision,
  lng double precision,
  hole integer,
  par integer,
  caption text,
  media_url text not null,
  media_type text not null check (media_type in ('photo', 'video')),
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists posts_user_id_idx on public.posts (user_id);
create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_course_id_idx on public.posts (course_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'posts_user_id_profiles_fkey'
  ) then
    alter table public.posts
      add constraint posts_user_id_profiles_fkey
      foreign key (user_id) references public.profiles (user_id) on delete cascade;
  end if;
end $$;

alter table public.posts enable row level security;

drop policy if exists "Posts are viewable by everyone" on public.posts;
create policy "Posts are viewable by everyone"
  on public.posts for select
  using (true);

drop policy if exists "Users can create their own posts" on public.posts;
create policy "Users can create their own posts"
  on public.posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own posts" on public.posts;
create policy "Users can update their own posts"
  on public.posts for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own posts" on public.posts;
create policy "Users can delete their own posts"
  on public.posts for delete
  using (auth.uid() = user_id);

-- Scorecards: a completed round, replacing the old on-device-only AsyncStorage store.
create table if not exists public.scorecards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text,
  course_name text not null,
  city text,
  state text,
  lat double precision,
  lng double precision,
  holes_count integer not null,
  holes jsonb not null,
  total_score integer not null,
  total_par integer not null,
  played_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists scorecards_user_id_idx on public.scorecards (user_id);
create index if not exists scorecards_course_id_idx on public.scorecards (course_id);

alter table public.scorecards enable row level security;

drop policy if exists "Scorecards are viewable by everyone" on public.scorecards;
create policy "Scorecards are viewable by everyone"
  on public.scorecards for select
  using (true);

drop policy if exists "Users can create their own scorecards" on public.scorecards;
create policy "Users can create their own scorecards"
  on public.scorecards for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own scorecards" on public.scorecards;
create policy "Users can update their own scorecards"
  on public.scorecards for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own scorecards" on public.scorecards;
create policy "Users can delete their own scorecards"
  on public.scorecards for delete
  using (auth.uid() = user_id);

-- Storage bucket for post photos/videos, public read (feed media needs to
-- load without auth), writes restricted to the uploading user's own folder
-- (objects are stored at `${user_id}/...`).
insert into storage.buckets (id, name, public)
values ('posts', 'posts', true)
on conflict (id) do nothing;

drop policy if exists "Post media is publicly readable" on storage.objects;
create policy "Post media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'posts');

drop policy if exists "Users can upload post media to their own folder" on storage.objects;
create policy "Users can upload post media to their own folder"
  on storage.objects for insert
  with check (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own post media" on storage.objects;
create policy "Users can delete their own post media"
  on storage.objects for delete
  using (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
