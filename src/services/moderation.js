import { supabase } from './supabase';

export const REPORT_REASONS = ['Inappropriate content', 'Spam', 'Harassment', 'Underage user', 'Other'];

// Fire-and-forget: the report row is what matters for moderation (it's
// already saved by the time this runs) — a failed email should never surface
// as an error to the reporting user, only get logged for follow-up.
function sendReportNotification(payload) {
  supabase.functions
    .invoke('report-notification', { body: payload })
    .then(({ error }) => {
      if (error) throw error;
      console.log('[moderation] report notification email sent for post', payload.postId);
    })
    .catch((err) => console.error('[moderation] failed to send report notification email:', err.message));
}

// Records a report as the reporter, then emails the admin (see the
// report-notification edge function). Returns whether this report was the
// one that pushed the post over the 5-report auto-hide threshold, so the
// caller can drop it from the reporter's own feed immediately.
export async function reportPost(reporterId, { postId, reason, reporterUsername, mediaUrl }) {
  const { error } = await supabase
    .from('reports')
    .insert({ post_id: postId, reporter_id: reporterId, reason });

  if (error) throw error;

  // reports_count/hidden are updated by a DB trigger (see schema.sql) —
  // read them back to know whether this exact report crossed the threshold.
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('hidden')
    .eq('id', postId)
    .single();

  const autoHidden = postError ? false : Boolean(post?.hidden);
  if (postError) {
    console.error('[moderation] failed to read post after report:', postError.message);
  }

  sendReportNotification({ postId, reporterUsername, reason, mediaUrl, autoHidden });

  return { autoHidden };
}

export async function blockUser(blockerId, blockedId) {
  if (blockerId === blockedId) return null;
  const { data, error } = await supabase
    .from('blocked_users')
    .insert({ blocker_id: blockerId, blocked_id: blockedId })
    .select()
    .single();

  if (error && error.code !== '23505') throw error; // ignore "already blocked"
  return data;
}

// Used by the Feed to exclude posts from anyone the current user has blocked.
export async function getBlockedUserIds(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', userId);

  if (error) throw error;
  return (data ?? []).map((row) => row.blocked_id);
}
