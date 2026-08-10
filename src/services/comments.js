import { supabase } from './supabase';
import { createNotification } from './notifications';
import { resolveMentionedUserIds } from './mentions';

function timeAgo(isoDate) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function mapRow(row) {
  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    username: row.profiles?.username ?? 'golfer',
    fullName: row.profiles?.full_name ?? null,
    avatarUrl: row.profiles?.avatar_url ?? null,
    commentText: row.comment_text,
    timeAgo: timeAgo(row.created_at),
    createdAt: row.created_at,
  };
}

export async function getComments(postId) {
  const { data, error } = await supabase
    .from('comments')
    .select('*, profiles!comments_user_id_profiles_fkey(username, full_name, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

// Posts a comment, then fires the two notification flows the comment can
// trigger: the post owner learns someone commented, and anyone @mentioned
// in the text learns they were tagged.
export async function addComment({ postId, userId, commentText, postOwnerId }) {
  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, user_id: userId, comment_text: commentText })
    .select('*, profiles!comments_user_id_profiles_fkey(username, full_name, avatar_url)')
    .single();

  if (error) throw error;

  if (postOwnerId) {
    await createNotification({ userId: postOwnerId, actorId: userId, type: 'comment', postId });
  }

  const mentionedUserIds = await resolveMentionedUserIds(commentText);
  await Promise.all(
    mentionedUserIds
      .filter((mentionedId) => mentionedId !== postOwnerId)
      .map((mentionedId) => createNotification({ userId: mentionedId, actorId: userId, type: 'mention', postId }))
  );

  return mapRow(data);
}

// Batch-fetches which of `commentIds` the given user has already liked, so
// CommentSheet can hydrate every row's heart-fill state in one query instead
// of one per comment.
export async function getLikedCommentIds(userId, commentIds) {
  if (!userId || !commentIds?.length) return [];
  const { data, error } = await supabase
    .from('comment_likes')
    .select('comment_id')
    .eq('user_id', userId)
    .in('comment_id', commentIds);

  if (error) throw error;
  return (data ?? []).map((row) => row.comment_id);
}

export async function likeComment(userId, commentId) {
  const { error } = await supabase.from('comment_likes').insert({ user_id: userId, comment_id: commentId });
  if (error && error.code !== '23505') throw error; // ignore "already liked"
}

export async function unlikeComment(userId, commentId) {
  const { error } = await supabase
    .from('comment_likes')
    .delete()
    .eq('user_id', userId)
    .eq('comment_id', commentId);

  if (error) throw error;
}
