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

-- Profile photo: shown on the Profile screen, the feed, comments, and
-- optionally scorecards.
alter table public.profiles add column if not exists avatar_url text;

-- Storage bucket for profile photos, public read, writes restricted to the
-- uploading user's own folder (objects are stored at `${user_id}/...`).
-- Uploads use upsert so re-picking a photo overwrites the same object,
-- which needs an UPDATE policy in addition to INSERT.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar photos are publicly readable" on storage.objects;
create policy "Avatar photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload avatars to their own folder" on storage.objects;
create policy "Users can upload avatars to their own folder"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can replace their own avatar" on storage.objects;
create policy "Users can replace their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Comments: one row per comment on a post. user_id carries the same
-- dual-FK pattern as posts.user_id so PostgREST can embed the commenter's
-- profile (username, avatar_url) alongside each row.
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  comment_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_post_id_idx on public.comments (post_id);
create index if not exists comments_user_id_idx on public.comments (user_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'comments_user_id_profiles_fkey'
  ) then
    alter table public.comments
      add constraint comments_user_id_profiles_fkey
      foreign key (user_id) references public.profiles (user_id) on delete cascade;
  end if;
end $$;

alter table public.comments enable row level security;

drop policy if exists "Comments are viewable by everyone" on public.comments;
create policy "Comments are viewable by everyone"
  on public.comments for select
  using (true);

drop policy if exists "Users can add comments as themselves" on public.comments;
create policy "Users can add comments as themselves"
  on public.comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own comments" on public.comments;
create policy "Users can delete their own comments"
  on public.comments for delete
  using (auth.uid() = user_id);

-- Keeps posts.comments_count in sync so the Feed tab's "most liked and
-- commented" sort has real numbers to sort on.
create or replace function public.handle_comments_count_change()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set comments_count = comments_count + 1 where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.posts set comments_count = greatest(comments_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists comments_count_after_insert on public.comments;
create trigger comments_count_after_insert
  after insert on public.comments
  for each row execute function public.handle_comments_count_change();

drop trigger if exists comments_count_after_delete on public.comments;
create trigger comments_count_after_delete
  after delete on public.comments
  for each row execute function public.handle_comments_count_change();

-- Post likes: one row per (post, user) so a like can be toggled per-user
-- and posts.likes_count stays accurate for the Feed tab's sort and for
-- deciding when to fire a "liked your post" notification.
create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint post_likes_unique unique (post_id, user_id)
);

create index if not exists post_likes_post_id_idx on public.post_likes (post_id);
create index if not exists post_likes_user_id_idx on public.post_likes (user_id);

alter table public.post_likes enable row level security;

drop policy if exists "Post likes are viewable by everyone" on public.post_likes;
create policy "Post likes are viewable by everyone"
  on public.post_likes for select
  using (true);

drop policy if exists "Users can like posts as themselves" on public.post_likes;
create policy "Users can like posts as themselves"
  on public.post_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can unlike posts as themselves" on public.post_likes;
create policy "Users can unlike posts as themselves"
  on public.post_likes for delete
  using (auth.uid() = user_id);

create or replace function public.handle_post_likes_count_change()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set likes_count = likes_count + 1 where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists post_likes_count_after_insert on public.post_likes;
create trigger post_likes_count_after_insert
  after insert on public.post_likes
  for each row execute function public.handle_post_likes_count_change();

drop trigger if exists post_likes_count_after_delete on public.post_likes;
create trigger post_likes_count_after_delete
  after delete on public.post_likes
  for each row execute function public.handle_post_likes_count_change();

-- Notifications: fired when a post gets liked, commented on, shared, or a
-- user is mentioned in a comment. actor_id carries the same dual-FK
-- pattern so PostgREST can embed the acting user's profile (username,
-- avatar_url). RLS only lets a user read their own notifications, but lets
-- any signed-in user insert a notification *about themselves* (as the
-- actor) for someone else — that's what lets "user A likes user B's post"
-- create a row addressed to B while running under A's session.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('like', 'comment', 'share', 'mention')),
  post_id uuid references public.posts (id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'notifications_actor_id_profiles_fkey'
  ) then
    alter table public.notifications
      add constraint notifications_actor_id_profiles_fkey
      foreign key (actor_id) references public.profiles (user_id) on delete cascade;
  end if;
end $$;

alter table public.notifications enable row level security;

drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create notifications as the acting user" on public.notifications;
create policy "Users can create notifications as the acting user"
  on public.notifications for insert
  with check (auth.uid() = actor_id);

drop policy if exists "Users can mark their own notifications read" on public.notifications;
create policy "Users can mark their own notifications read"
  on public.notifications for update
  using (auth.uid() = user_id);

-- Course rankings: a user's personal 0.0-10.0 rating for a course, shown
-- in the Profile screen's Course Rankings tab.
create table if not exists public.course_rankings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text,
  course_name text not null,
  rating numeric(3, 1) not null check (rating >= 0 and rating <= 10),
  created_at timestamptz not null default now()
);

create index if not exists course_rankings_user_id_idx on public.course_rankings (user_id);

alter table public.course_rankings enable row level security;

drop policy if exists "Course rankings are viewable by everyone" on public.course_rankings;
create policy "Course rankings are viewable by everyone"
  on public.course_rankings for select
  using (true);

drop policy if exists "Users can create their own course rankings" on public.course_rankings;
create policy "Users can create their own course rankings"
  on public.course_rankings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own course rankings" on public.course_rankings;
create policy "Users can update their own course rankings"
  on public.course_rankings for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own course rankings" on public.course_rankings;
create policy "Users can delete their own course rankings"
  on public.course_rankings for delete
  using (auth.uid() = user_id);
