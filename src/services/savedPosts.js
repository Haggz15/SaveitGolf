import { supabase } from './supabase';

export async function savePost(userId, postId) {
  if (!userId || !postId) return;
  const { error } = await supabase.from('saved_posts').insert({ user_id: userId, post_id: postId });
  if (error && error.code !== '23505') throw error; // ignore "already saved"
}

export async function unsavePost(userId, postId) {
  if (!userId || !postId) return;
  const { error } = await supabase
    .from('saved_posts')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId);

  if (error) throw error;
}

// Mirrors likes.js's getLikedPostIds — used to hydrate each PostSlide's
// initial bookmark state for the posts currently on screen.
export async function getSavedPostIds(userId, postIds) {
  if (!userId || !postIds?.length) return [];
  const { data, error } = await supabase
    .from('saved_posts')
    .select('post_id')
    .eq('user_id', userId)
    .in('post_id', postIds);

  if (error) throw error;
  return (data ?? []).map((row) => row.post_id);
}
