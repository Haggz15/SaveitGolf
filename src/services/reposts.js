import { supabase } from './supabase';
import { mapRow as mapPostRow } from './posts';

// Reposts share another user's post into the reposter's followers' feeds.
// They live in their own table (see supabase/schema.sql), so they never
// touch Shot of the Week scoring, which only reads public.posts.

export async function repostPost(userId, postId) {
  if (!userId || !postId) return;
  const { error } = await supabase.from('reposts').insert({ user_id: userId, post_id: postId });
  if (error && error.code !== '23505') throw error; // ignore "already reposted"
}

export async function undoRepost(userId, postId) {
  if (!userId || !postId) return;
  const { error } = await supabase.from('reposts').delete().eq('user_id', userId).eq('post_id', postId);
  if (error) throw error;
}

// Post ids the user has reposted. Pass `postIds` to only check those posts,
// the way getLikedPostIds/getSavedPostIds hydrate the posts on screen.
export async function getUserReposts(userId, postIds) {
  if (!userId) return [];
  if (postIds && postIds.length === 0) return [];
  let request = supabase.from('reposts').select('post_id').eq('user_id', userId);
  if (postIds) request = request.in('post_id', postIds);
  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []).map((row) => row.post_id);
}

// The feed reads posts.reposts_count instead; this is for one-off checks.
export async function getRepostCount(postId) {
  const { count, error } = await supabase
    .from('reposts')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', postId);
  if (error) throw error;
  return count ?? 0;
}

// Reposts made by `followingIds`, newest repost first, each returned as the
// original post (author, media, counts) plus who reposted it and when.
// Hidden posts are filtered out in the query itself, so a short page still
// means there are no more reposts.
export async function getFeedReposts(followingIds, limit = 20, offset = 0) {
  if (!followingIds?.length) return [];
  const { data, error } = await supabase
    .from('reposts')
    .select(
      'created_at, user_id, ' +
        'reposter:profiles!reposts_user_id_profiles_fkey(user_id, username, avatar_url), ' +
        'post:posts!reposts_post_id_fkey!inner(*, profiles!posts_user_id_profiles_fkey(username, full_name, avatar_url))'
    )
    .in('user_id', followingIds)
    .eq('post.hidden', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  return (data ?? [])
    .filter((row) => row.post)
    .map((row) => ({
      ...mapPostRow(row.post),
      isRepost: true,
      repostedAt: row.created_at,
      repostedBy: {
        id: row.user_id,
        username: row.reposter?.username ?? null,
        avatar_url: row.reposter?.avatar_url ?? null,
      },
    }));
}
