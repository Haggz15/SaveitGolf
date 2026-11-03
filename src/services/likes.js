import { supabase } from './supabase';

export async function likePost(postId, userId) {
  const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
  if (error && error.code !== '23505') throw error; // ignore "already liked"
}

export async function unlikePost(postId, userId) {
  const { error } = await supabase
    .from('post_likes')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);

  if (error) throw error;
}

// Stamps isLiked onto each post: one post_likes query for the rows where
// user_id = userId and post_id is any of the posts' ids. Profile grids fetch
// posts with getUserPosts, which knows nothing about the viewer, so without
// this every post opened from a profile arrived with its heart unlit.
// A failed lookup leaves the posts as they were (isLiked false) rather than
// failing the whole grid; ProfileFeed's focus refresh corrects it anyway.
export async function withLikedState(posts, userId) {
  if (!userId || !posts || posts.length === 0) return posts ?? [];
  try {
    const liked = new Set(await getLikedPostIds(userId, posts.map((p) => p.id)));
    return posts.map((p) => ({ ...p, isLiked: liked.has(p.id) }));
  } catch (err) {
    console.error('Failed to load liked state for posts:', err);
    return posts;
  }
}

// The live like state of `postIds`, straight from Supabase: likes_count
// (kept current by the post_likes trigger) and whether `userId` has liked
// each one. Returns a Map of postId -> { likes, liked }. Used by the post
// viewer on focus so it never trusts the possibly stale post objects it was
// handed through navigation params.
export async function getPostLikeState(postIds, userId) {
  const state = new Map();
  if (!postIds || postIds.length === 0) return state;
  const [countsRes, likedIds] = await Promise.all([
    supabase.from('posts').select('id, likes_count').in('id', postIds),
    getLikedPostIds(userId, postIds),
  ]);
  if (countsRes.error) throw countsRes.error;
  const liked = new Set(likedIds);
  for (const row of countsRes.data ?? []) {
    state.set(row.id, { likes: row.likes_count ?? 0, liked: liked.has(row.id) });
  }
  return state;
}

// Which of `postIds` the given user has already liked — used to seed the
// Feed's heart icons correctly on load.
export async function getLikedPostIds(userId, postIds) {
  if (!userId || !postIds || postIds.length === 0) return [];
  const { data, error } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('user_id', userId)
    .in('post_id', postIds);

  if (error) throw error;
  return (data ?? []).map((row) => row.post_id);
}
