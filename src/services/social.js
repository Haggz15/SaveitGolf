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
