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

const EARTH_RADIUS_MILES = 3958.8;
const MILES_PER_DEGREE_LAT = 69;

function haversineMiles(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
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

// "Golfers Near You": other golfers with a post or My Courses entry within
// `radiusMiles` of (latitude, longitude), closest first. A bounding box
// narrows the rows server-side, then Haversine drops the box's corners.
// `excludeIds` (the signed-in user plus everyone they follow) are skipped.
export async function getNearbyGolfers({ latitude, longitude, radiusMiles = 100, limit = 8, excludeIds = [] }) {
  const latDelta = radiusMiles / MILES_PER_DEGREE_LAT;
  const lngDelta = radiusMiles / (MILES_PER_DEGREE_LAT * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01));
  const box = {
    minLat: latitude - latDelta,
    maxLat: latitude + latDelta,
    minLng: longitude - lngDelta,
    maxLng: longitude + lngDelta,
  };

  const [posts, courses] = await Promise.all([
    supabase
      .from('posts')
      .select('user_id, lat, lng')
      .gte('lat', box.minLat)
      .lte('lat', box.maxLat)
      .gte('lng', box.minLng)
      .lte('lng', box.maxLng)
      .limit(1000),
    supabase
      .from('my_courses')
      .select('user_id, latitude, longitude')
      .gte('latitude', box.minLat)
      .lte('latitude', box.maxLat)
      .gte('longitude', box.minLng)
      .lte('longitude', box.maxLng)
      .limit(1000),
  ]);
  console.log('[findGolfers] near you — posts in box:', posts.error ?? posts.data);
  console.log('[findGolfers] near you — my_courses in box:', courses.error ?? courses.data);
  if (posts.error) throw posts.error;
  if (courses.error) throw courses.error;

  const excluded = new Set(excludeIds);
  const nearest = new Map();
  const consider = (userId, lat, lng) => {
    if (excluded.has(userId) || lat == null || lng == null) return;
    const miles = haversineMiles(latitude, longitude, lat, lng);
    if (miles > radiusMiles) return;
    if (!nearest.has(userId) || miles < nearest.get(userId)) nearest.set(userId, miles);
  };
  (posts.data ?? []).forEach((row) => consider(row.user_id, row.lat, row.lng));
  (courses.data ?? []).forEach((row) => consider(row.user_id, row.latitude, row.longitude));

  const ids = [...nearest.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, limit)
    .map(([id]) => id);
  const golfers = await getGolfersByIds(ids);
  console.log('[findGolfers] near you — golfers:', golfers);
  return golfers;
}

// "Popular on SaveitGolf": every golfer not in `excludeIds`, most followers
// first (golfers with 0 followers included), ties broken by username.
export async function getPopularGolfers({ limit = 10, excludeIds = [] } = {}) {
  const [profiles, follows] = await Promise.all([
    supabase.from('profiles').select('user_id, username, full_name, avatar_url'),
    supabase.from('followers').select('following_id'),
  ]);
  console.log('[findGolfers] popular — profiles:', profiles.error ?? profiles.data);
  console.log('[findGolfers] popular — followers:', follows.error ?? follows.data);
  if (profiles.error) throw profiles.error;
  if (follows.error) throw follows.error;

  const excluded = new Set(excludeIds);
  const counts = countFollowers(follows.data);
  const golfers = (profiles.data ?? [])
    .filter((p) => !excluded.has(p.user_id))
    .map((p) => mapGolfer({ ...p, follower_count: counts.get(p.user_id) ?? 0 }))
    .sort((a, b) => b.followerCount - a.followerCount || (a.username ?? '').localeCompare(b.username ?? ''))
    .slice(0, limit);
  console.log('[findGolfers] popular — golfers:', golfers);
  return golfers;
}
