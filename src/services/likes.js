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
