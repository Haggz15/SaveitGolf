import { supabase } from './supabase';
import { createNotification } from './notifications';

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
