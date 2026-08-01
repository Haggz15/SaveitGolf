import { supabase } from './supabase';

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

const ACTION_TEXT = {
  like: 'liked your post',
  comment: 'commented on your post',
  share: 'shared your post',
  mention: 'mentioned you in a comment',
};

function mapRow(row) {
  return {
    id: row.id,
    type: row.type,
    postId: row.post_id,
    read: row.read,
    actorId: row.actor_id,
    actorUsername: row.profiles?.username ?? 'golfer',
    actorFullName: row.profiles?.full_name ?? null,
    actorAvatarUrl: row.profiles?.avatar_url ?? null,
    actionText: ACTION_TEXT[row.type] ?? 'did something',
    timeAgo: timeAgo(row.created_at),
    createdAt: row.created_at,
  };
}

export async function getNotifications(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*, profiles!notifications_actor_id_profiles_fkey(username, full_name, avatar_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getUnreadNotificationCount(userId) {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;
  return count ?? 0;
}

export async function markAllNotificationsRead(userId) {
  if (!userId) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;
}

// Fires a notification for `userId` describing something `actorId` did.
// Silently skipped when acting on your own post/comment — nobody needs to
// be notified that they liked their own post.
export async function createNotification({ userId, actorId, type, postId }) {
  if (!userId || !actorId || userId === actorId) return;
  const { error } = await supabase
    .from('notifications')
    .insert({ user_id: userId, actor_id: actorId, type, post_id: postId ?? null });

  if (error) throw error;
}
