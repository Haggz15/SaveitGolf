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

-- Optional photo attached on the Scorecard screen, used as the full
-- background of the scorecard card and its camera-roll share image.
alter table public.scorecards add column if not exists photo_url text;

-- Optional user-typed nine name(s) (e.g. "Blue", "Ridge / Trail") for
-- courses with multiple/composite nines, set on the hole-count step of
-- scorecard creation. composite_back only applies to 18-hole rounds.
alter table public.scorecards add column if not exists composite_front text;
alter table public.scorecards add column if not exists composite_back text;

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

-- Extends notifications with the two in-app activity types (new_post,
-- new_scorecard) fired when someone you follow posts or logs a round, plus
-- the columns those types need: scorecard_id (post_id is post-only) and a
-- denormalized course_name (matches how posts.course_name is itself
-- denormalized) so the panel can render "posted at {course}" without a
-- conditional join across posts vs scorecards.
-- 'tag' (caption tagging) and 'follow' (new follower) added alongside the
-- rest — kept in the same constraint rather than a separate migration.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('like', 'comment', 'share', 'mention', 'new_post', 'new_scorecard', 'tag', 'follow'));

alter table public.notifications add column if not exists scorecard_id uuid references public.scorecards (id) on delete cascade;
alter table public.notifications add column if not exists course_name text;

-- Saved posts: bookmarking a feed post saves it here so it can be shown
-- on the user's own profile later (viewing that list is a follow-up, not
-- built in this pass).
create table if not exists public.saved_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_posts_unique unique (user_id, post_id)
);

create index if not exists saved_posts_user_id_idx on public.saved_posts (user_id);

alter table public.saved_posts enable row level security;

drop policy if exists "Users can view their own saved posts" on public.saved_posts;
create policy "Users can view their own saved posts"
  on public.saved_posts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can save posts as themselves" on public.saved_posts;
create policy "Users can save posts as themselves"
  on public.saved_posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can unsave their own saved posts" on public.saved_posts;
create policy "Users can unsave their own saved posts"
  on public.saved_posts for delete
  using (auth.uid() = user_id);

-- Shot of the Week: posts.shares_count tracks the third engagement signal
-- (likes_count and comments_count already exist) via an RPC instead of a
-- trigger, since shares aren't rows in their own table — just a counter
-- bumped after a successful native share.
alter table public.posts add column if not exists shares_count integer not null default 0;

create or replace function public.increment_share_count(post_id uuid)
returns void as $$
begin
  update public.posts set shares_count = shares_count + 1 where id = post_id;
end;
$$ language plpgsql security definer;

grant execute on function public.increment_share_count(uuid) to authenticated;

create table if not exists public.shot_of_week (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  week_start date not null unique,
  created_at timestamptz not null default now()
);

alter table public.shot_of_week enable row level security;

drop policy if exists "Shot of the week is viewable by everyone" on public.shot_of_week;
create policy "Shot of the week is viewable by everyone"
  on public.shot_of_week for select
  using (true);

-- No insert/update/delete policy: this table is only ever written by
-- calculate_shot_of_week() below (security definer), invoked by the
-- pg_cron job — never directly by client requests.

-- Finds the post with the highest combined likes+comments+shares created
-- in the most recently completed Friday-6pm -> Friday-6pm window and pins
-- it as that week's Shot of the Week. week_start is keyed to the UTC
-- Friday the window opened -- 22:00 UTC is used as a stand-in for 6pm US
-- Eastern below, since Postgres cron schedules don't shift with daylight
-- saving.
create or replace function public.calculate_shot_of_week()
returns void as $$
declare
  window_end timestamptz := date_trunc('week', now()) + interval '4 days 22 hours';
  window_start timestamptz;
  winner_post_id uuid;
  winner_week_start date;
begin
  if now() < window_end then
    window_end := window_end - interval '7 days';
  end if;
  window_start := window_end - interval '7 days';
  winner_week_start := window_start::date;

  select id into winner_post_id
  from public.posts
  where created_at >= window_start and created_at < window_end
  order by (likes_count + comments_count + shares_count) desc, created_at desc
  limit 1;

  if winner_post_id is not null then
    insert into public.shot_of_week (post_id, week_start)
    values (winner_post_id, winner_week_start)
    on conflict (week_start) do update set post_id = excluded.post_id;
  end if;
end;
$$ language plpgsql security definer;

-- Schedules the weekly run via pg_cron. This requires the pg_cron
-- extension, which isn't enabled by default -- turn it on once via the
-- Supabase dashboard (Database -> Extensions -> pg_cron), then re-run this
-- file (or just this block) to register the schedule. Safe to run before
-- that: it detects the missing extension and skips with a notice instead
-- of failing.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'shot-of-week-weekly') then
      perform cron.schedule(
        'shot-of-week-weekly',
        '0 22 * * 5',
        $cron$select public.calculate_shot_of_week();$cron$
      );
    end if;
  else
    raise notice 'pg_cron extension not installed -- enable it (Database > Extensions) then re-run this file to schedule the weekly Shot of the Week job.';
  end if;
end $$;

-- My Courses: a user's personal course wishlist, shown in the Profile
-- screen's My Courses tab and used by the Map's "Courses I've Played"
-- filter to drop pins at each saved course's stored coordinates.
create table if not exists public.my_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text,
  course_name text not null,
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create index if not exists my_courses_user_id_idx on public.my_courses (user_id);

-- Lets the app upsert on (user_id, course_id) so re-adding the same course
-- updates the existing row instead of creating a duplicate. Rows with a null
-- course_id never collide (nulls are never equal in a unique index), so
-- those always insert as new rows.
create unique index if not exists my_courses_user_course_idx
  on public.my_courses (user_id, course_id);

alter table public.my_courses enable row level security;

drop policy if exists "My courses are viewable by everyone" on public.my_courses;
create policy "My courses are viewable by everyone"
  on public.my_courses for select
  using (true);

drop policy if exists "Users can add their own courses" on public.my_courses;
create policy "Users can add their own courses"
  on public.my_courses for insert
  with check (auth.uid() = user_id);

-- Needed for the upsert-on-conflict path (re-adding an already-saved course).
drop policy if exists "Users can update their own courses" on public.my_courses;
create policy "Users can update their own courses"
  on public.my_courses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own courses" on public.my_courses;
create policy "Users can remove their own courses"
  on public.my_courses for delete
  using (auth.uid() = user_id);

-- Content moderation: reports_count is kept in sync by the trigger below
-- (same denormalized-counter pattern as likes_count/comments_count), and
-- hidden flips true the moment a post crosses 5 reports so the app can just
-- filter `hidden = false` instead of counting reports itself on every read.
alter table public.posts add column if not exists reports_count integer not null default 0;
alter table public.posts add column if not exists hidden boolean not null default false;

-- Optional name for the specific nine played, for courses with more than 18
-- holes or informally-named combo nines (e.g. "Ridge", "Blue") — same concept
-- as scorecards.composite_front/composite_back, but a post only ever tags one
-- nine at a time since it's about a single hole.
alter table public.posts add column if not exists composite_name text;

-- Reports: one row per (post, reporter) so the same user can't inflate a
-- post's count by reporting it repeatedly. No update/delete policy for
-- regular users — status (pending/reviewed/dismissed/removed) is triaged by
-- the admin directly in the Supabase table editor using the service role,
-- which bypasses RLS entirely.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (
    reason in ('Inappropriate content', 'Spam', 'Harassment', 'Underage user', 'Other')
  ),
  status text not null default 'pending' check (
    status in ('pending', 'reviewed', 'dismissed', 'removed')
  ),
  created_at timestamptz not null default now(),
  constraint reports_unique unique (post_id, reporter_id)
);

create index if not exists reports_post_id_idx on public.reports (post_id);
create index if not exists reports_reporter_id_idx on public.reports (reporter_id);
create index if not exists reports_status_idx on public.reports (status);

alter table public.reports enable row level security;

drop policy if exists "Users can view their own reports" on public.reports;
create policy "Users can view their own reports"
  on public.reports for select
  using (auth.uid() = reporter_id);

drop policy if exists "Users can report posts as themselves" on public.reports;
create policy "Users can report posts as themselves"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

-- Keeps posts.reports_count in sync and auto-hides a post the moment its
-- report count reaches 5 (mirrors handle_post_likes_count_change). Deleting
-- a report only decrements the counter — it never un-hides a post, since an
-- admin who wants a wrongly-hidden post back should do so deliberately
-- (updating posts.hidden directly) rather than have it flip back silently.
create or replace function public.handle_post_reports_count_change()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts
      set reports_count = reports_count + 1,
          hidden = hidden or (reports_count + 1) >= 5
      where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.posts set reports_count = greatest(reports_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists reports_count_after_insert on public.reports;
create trigger reports_count_after_insert
  after insert on public.reports
  for each row execute function public.handle_post_reports_count_change();

drop trigger if exists reports_count_after_delete on public.reports;
create trigger reports_count_after_delete
  after delete on public.reports
  for each row execute function public.handle_post_reports_count_change();

-- Blocked users: mirrors followers' shape (blocker_id/blocked_id instead of
-- follower_id/following_id), but who-blocked-whom is private — unlike
-- followers, there's no "viewable by everyone" select policy.
create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocked_users_no_self_block check (blocker_id <> blocked_id),
  constraint blocked_users_unique unique (blocker_id, blocked_id)
);

create index if not exists blocked_users_blocker_id_idx on public.blocked_users (blocker_id);
create index if not exists blocked_users_blocked_id_idx on public.blocked_users (blocked_id);

alter table public.blocked_users enable row level security;

drop policy if exists "Users can view their own blocks" on public.blocked_users;
create policy "Users can view their own blocks"
  on public.blocked_users for select
  using (auth.uid() = blocker_id);

drop policy if exists "Users can block as themselves" on public.blocked_users;
create policy "Users can block as themselves"
  on public.blocked_users for insert
  with check (auth.uid() = blocker_id);

drop policy if exists "Users can unblock their own blocks" on public.blocked_users;
create policy "Users can unblock their own blocks"
  on public.blocked_users for delete
  using (auth.uid() = blocker_id);

-- Post tags: one row per user @mentioned in a post's caption, recorded
-- separately from the caption text so the "tagged you in a post"
-- notification and any future "posts you're tagged in" list don't have to
-- re-parse @mentions out of free text. tagged_by is the post's author
-- (always the one typing the caption), tagged_user_id the mentioned user.
create table if not exists public.post_tags (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  tagged_user_id uuid not null references auth.users (id) on delete cascade,
  tagged_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint post_tags_unique unique (post_id, tagged_user_id)
);

create index if not exists post_tags_post_id_idx on public.post_tags (post_id);
create index if not exists post_tags_tagged_user_id_idx on public.post_tags (tagged_user_id);

alter table public.post_tags enable row level security;

drop policy if exists "Post tags are viewable by everyone" on public.post_tags;
create policy "Post tags are viewable by everyone"
  on public.post_tags for select
  using (true);

drop policy if exists "Users can tag others as the post author" on public.post_tags;
create policy "Users can tag others as the post author"
  on public.post_tags for insert
  with check (auth.uid() = tagged_by);

drop policy if exists "Post authors can remove their own tags" on public.post_tags;
create policy "Post authors can remove their own tags"
  on public.post_tags for delete
  using (auth.uid() = tagged_by);

-- Comment likes: mirrors post_likes' shape (one row per comment/user pair)
-- for the small heart on each comment row. Kept as its own table rather
-- than folded into post_likes since it likes a comment, not a post.
create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint comment_likes_unique unique (comment_id, user_id)
);

create index if not exists comment_likes_comment_id_idx on public.comment_likes (comment_id);
create index if not exists comment_likes_user_id_idx on public.comment_likes (user_id);

alter table public.comment_likes enable row level security;

drop policy if exists "Comment likes are viewable by everyone" on public.comment_likes;
create policy "Comment likes are viewable by everyone"
  on public.comment_likes for select
  using (true);

drop policy if exists "Users can like comments as themselves" on public.comment_likes;
create policy "Users can like comments as themselves"
  on public.comment_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can unlike comments as themselves" on public.comment_likes;
create policy "Users can unlike comments as themselves"
  on public.comment_likes for delete
  using (auth.uid() = user_id);
