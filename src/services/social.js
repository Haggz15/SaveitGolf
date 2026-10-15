import { supabase } from './supabase';
import { createNotification } from './notifications';
import { escapeIlike, quoteOrValue } from '../utils/ilike';

// Matches on username or full_name, case-insensitive, excluding the current
// user so people don't see a "Follow yourself" result.
export async function searchProfiles(query, currentUserId) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  let request = supabase
    .from('profiles')
    .select('id, user_id, username, full_name, home_state, avatar_url')
    .or(`username.ilike.%${trimmed}%,full_name.ilike.%${trimmed}%`)
    .limit(20);

  if (currentUserId) {
    request = request.neq('user_id', currentUserId);
  }

  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}

// Prefix match on username only, capped at 5 — used by the Map screen's
// Friend Search input (see FriendSearchBar), which is narrower on purpose
// than searchProfiles above (no full_name match, no cap-20 dropdown) since
// it's meant to resolve a single specific friend quickly, not browse.
export async function searchProfilesByUsernamePrefix(query, currentUserId) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  let request = supabase
    .from('profiles')
    .select('username, full_name, avatar_url, user_id')
    .ilike('username', `${trimmed}%`)
    .limit(5);

  if (currentUserId) {
    request = request.neq('user_id', currentUserId);
  }

  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}

export async function getProfileByUsername(username) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function followUser(followerId, followingId) {
  if (followerId === followingId) return null;
  const { data, error } = await supabase
    .from('followers')
    .insert({ follower_id: followerId, following_id: followingId })
    .select()
    .single();

  if (error && error.code !== '23505') throw error; // ignore "already following"

  if (data) {
    createNotification({ userId: followingId, actorId: followerId, type: 'follow' }).catch((err) =>
      console.error('Failed to notify followed user:', err)
    );
  }

  return data;
}

export async function unfollowUser(followerId, followingId) {
  const { error } = await supabase
    .from('followers')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);

  if (error) throw error;
}

export async function getFollowStatus(followerId, followingId) {
  if (!followerId || !followingId) return false;
  const { data, error } = await supabase
    .from('followers')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function getFollowerCount(userId) {
  const { count, error } = await supabase
    .from('followers')
    .select('id', { count: 'exact', head: true })
    .eq('following_id', userId);

  if (error) throw error;
  return count ?? 0;
}

export async function getFollowingCount(userId) {
  const { count, error } = await supabase
    .from('followers')
    .select('id', { count: 'exact', head: true })
    .eq('follower_id', userId);

  if (error) throw error;
  return count ?? 0;
}

// Used by the Feed's "Following" filter.
export async function getFollowingIds(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('followers')
    .select('following_id')
    .eq('follower_id', userId);

  if (error) throw error;
  return (data ?? []).map((row) => row.following_id);
}

// Full profile rows (not just ids) for the Followers/Following list modal.
// Fetched in two steps — followers row ids, then a separate `profiles`
// lookup — rather than a single embedded-join query, because the
// followers_*_profiles_fkey constraints that embed would rely on (see
// schema.sql) aren't present on every deployed database, and PostgREST
// errors the whole query out (PGRST200) when they're missing rather than
// falling back to a plain lookup.
export async function getFollowersList(userId) {
  const { data: rows, error } = await supabase
    .from('followers')
    .select('follower_id, created_at')
    .eq('following_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const ids = rows.map((row) => row.follower_id);
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, username, full_name, avatar_url')
    .in('user_id', ids);

  if (profilesError) throw profilesError;
  const byId = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

export async function getFollowingList(userId) {
  const { data: rows, error } = await supabase
    .from('followers')
    .select('following_id, created_at')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const ids = rows.map((row) => row.following_id);
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, username, full_name, avatar_url')
    .in('user_id', ids);

  if (profilesError) throw profilesError;
  const byId = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

// Find Golfers — rows from the golfer_profiles view (profile + live
// follower_count; see schema.sql), shaped for the screen's user rows.
function mapGolfer(row) {
  return {
    userId: row.user_id,
    username: row.username,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    followerCount: row.follower_count ?? 0,
  };
}

// Live search by username or full name, most-followed first. Unlike
// searchProfiles above, the text is matched literally (no "%"/"_"
// wildcards) and quoted so commas/periods don't break the .or() filter.
export async function searchGolfers(query, currentUserId) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const pattern = quoteOrValue(`%${escapeIlike(trimmed)}%`);

  let request = supabase
    .from('golfer_profiles')
    .select('user_id, username, full_name, avatar_url, follower_count')
    .or(`username.ilike.${pattern},full_name.ilike.${pattern}`)
    .order('follower_count', { ascending: false })
    .limit(20);
  if (currentUserId) request = request.neq('user_id', currentUserId);

  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []).map(mapGolfer);
}

// Profiles for `ids` in that order, each with a live follower count from
// the followers table.
async function getGolfersByIds(ids) {
  if (!ids.length) return [];
  const [{ data: profiles, error }, { data: follows, error: followsError }] = await Promise.all([
    supabase.from('profiles').select('user_id, username, full_name, avatar_url').in('user_id', ids),
    supabase.from('followers').select('following_id').in('following_id', ids),
  ]);
  if (error) throw error;
  if (followsError) throw followsError;
  const counts = countFollowers(follows);
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((p) => mapGolfer({ ...p, follower_count: counts.get(p.user_id) ?? 0 }));
}

function countFollowers(rows) {
  const counts = new Map();
  (rows ?? []).forEach((row) => counts.set(row.following_id, (counts.get(row.following_id) ?? 0) + 1));
  return counts;
}

// Course ids / names per .or() request — keeps the filter (and URL) short
// for users with long My Courses lists.
const SHARED_COURSE_CHUNK = 40;

// Rows from `table` (posts or my_courses) by anyone but `userId` at any of
// `courses`, matched on course_id or a case-insensitive exact course_name.
async function fetchRowsAtCourses(table, courses, userId) {
  const requests = [];
  for (let i = 0; i < courses.length; i += SHARED_COURSE_CHUNK) {
    const chunk = courses.slice(i, i + SHARED_COURSE_CHUNK);
    const ids = [...new Set(chunk.map((c) => c.course_id).filter(Boolean))];
    const filters = chunk
      .filter((c) => c.course_name?.trim())
      .map((c) => `course_name.ilike.${quoteOrValue(escapeIlike(c.course_name.trim()))}`);
    if (ids.length) filters.unshift(`course_id.in.(${ids.map(quoteOrValue).join(',')})`);
    if (!filters.length) continue;
    requests.push(
      supabase
        .from(table)
        .select('user_id, course_id, course_name')
        .neq('user_id', userId)
        .or(filters.join(','))
        .limit(1000)
    );
  }
  const results = await Promise.all(requests);
  const failed = results.find((r) => r.error);
  if (failed) throw failed.error;
  return results.flatMap((r) => r.data ?? []);
}

// "Golfers at Your Courses": other golfers who've posted at or saved any
// course in the signed-in user's My Courses, most shared courses first.
// A row counts toward one of the user's courses by course_id first, then
// by case-insensitive course_name. `excludeIds` (the user plus everyone
// they follow) are skipped.
export async function getGolfersAtYourCourses({ userId, limit = 8, excludeIds = [] }) {
  const { data: myCourses, error } = await supabase
    .from('my_courses')
    .select('course_id, course_name')
    .eq('user_id', userId);
  if (error) throw error;
  if (!myCourses?.length) return [];

  // Each of the user's courses gets one key, reachable by id or by name.
  const keyById = new Map();
  const keyByName = new Map();
  myCourses.forEach((c, i) => {
    if (c.course_id && !keyById.has(c.course_id)) keyById.set(c.course_id, i);
    const name = c.course_name?.trim().toLowerCase();
    if (name && !keyByName.has(name)) keyByName.set(name, i);
  });

  const [posts, saved] = await Promise.all([
    fetchRowsAtCourses('posts', myCourses, userId),
    fetchRowsAtCourses('my_courses', myCourses, userId),
  ]);

  const excluded = new Set(excludeIds);
  const shared = new Map();
  [...posts, ...saved].forEach((row) => {
    if (excluded.has(row.user_id)) return;
    const key = keyById.get(row.course_id) ?? keyByName.get(row.course_name?.trim().toLowerCase());
    if (key === undefined) return;
    if (!shared.has(row.user_id)) shared.set(row.user_id, new Set());
    shared.get(row.user_id).add(key);
  });

  const ids = [...shared.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, limit)
    .map(([id]) => id);
  return getGolfersByIds(ids);
}

// "Popular on SaveitGolf": golfers ranked by live follower count, most
// first, no minimum (0-follower golfers fill out the list). profiles has no
// stored follower_count — golfer_profiles counts followers rows per
// profile at query time — so sorting and limiting happen server-side.
// Followed golfers are NOT excluded: the most-followed golfers are exactly
// the ones a user is likely to follow already, and dropping them left the
// list showing only 0-follower golfers. `excludeIds` is who to leave out:
// the signed-in user on their own Find Golfers, or the profile owner when
// shown on someone else's page (the viewer then stays in).
export async function getPopularGolfers({ limit = 10, excludeIds = [] } = {}) {
  let request = supabase
    .from('golfer_profiles')
    .select('user_id, username, full_name, avatar_url, follower_count')
    .order('follower_count', { ascending: false })
    .order('username', { ascending: true })
    .limit(limit);
  const excluded = excludeIds.filter(Boolean);
  if (excluded.length) request = request.not('user_id', 'in', `(${excluded.join(',')})`);

  const { data, error } = await request;
  console.log('[popularGolfers] raw response:', JSON.stringify({ data, error }));
  if (!error) return (data ?? []).map(mapGolfer);

  // golfer_profiles not deployed — count followers rows client-side,
  // paging past PostgREST's 1000-row cap so no follows go uncounted.
  console.warn('[popularGolfers] golfer_profiles failed, counting followers client-side:', error);
  const [profiles, follows] = await Promise.all([
    supabase.from('profiles').select('user_id, username, full_name, avatar_url').limit(5000),
    fetchAllFollowingIds(),
  ]);
  console.log('[popularGolfers] raw fallback profiles:', JSON.stringify(profiles));
  if (profiles.error) throw profiles.error;
  const counts = countFollowers(follows);
  const excludedSet = new Set(excluded);
  return (profiles.data ?? [])
    .filter((p) => !excludedSet.has(p.user_id))
    .map((p) => mapGolfer({ ...p, follower_count: counts.get(p.user_id) ?? 0 }))
    .sort((a, b) => b.followerCount - a.followerCount || (a.username ?? '').localeCompare(b.username ?? ''))
    .slice(0, limit);
}

async function fetchAllFollowingIds() {
  const PAGE = 1000;
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('followers')
      .select('following_id')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}
