import { supabase } from './supabase';
import { mapRow as mapPostRow } from './posts';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

// Every week_start in shot_of_week, sotw_nominees and sotw_votes is the UTC
// Friday its scoring window opened (see calculate_shot_of_week() in
// supabase/schema.sql). Nominees are picked 7 days later, on the following
// Friday at 04:00 UTC, and calculate_sotw_winner_from_votes() counts the
// votes the Monday after that at 09:00 UTC — so a week's result is final
// 10 days and 9 hours after its week_start.
function weekStartMs(weekStart) {
  const [y, m, d] = String(weekStart).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function isSotwWeekFinal(weekStart, now = Date.now()) {
  return now >= weekStartMs(weekStart) + 10 * DAY_MS + 9 * HOUR_MS;
}

// Voting runs all of Friday through Sunday 11:59pm, in the viewer's local time.
export function isSotwVotingOpen(now = new Date()) {
  const day = now.getDay();
  return day === 5 || day === 6 || day === 0;
}

// The end of the current voting window: the coming Sunday at midnight
// (i.e. 00:00 Monday, local time).
export function getSotwVotingDeadline(now = new Date()) {
  const deadline = new Date(now);
  deadline.setHours(0, 0, 0, 0);
  deadline.setDate(deadline.getDate() + ((8 - deadline.getDay()) % 7 || 7));
  return deadline;
}

// The week the current nominees belong to — the newest week_start in
// sotw_nominees — and whether it's a test week. Stays current until next
// Friday's job adds new nominees.
//
// Test weeks: rows inserted by hand with is_test = true (and, usually,
// today's date as week_start, so they're the newest) open voting right away,
// whatever the day — see isSotwVotingOpenFor. Every screen that reads the
// current week (finalist badges, pinned finalists, votes, the voting screen)
// then uses those rows. Delete them afterwards (supabase/schema.sql has the
// cleanup query), because test rows are visible to every user.
async function getCurrentSotwWeek() {
  let { data, error } = await supabase
    .from('sotw_nominees')
    .select('week_start, is_test')
    .order('week_start', { ascending: false })
    .order('is_test', { ascending: false })
    .limit(1)
    .maybeSingle();
  // 42703 = undefined column: the is_test migration hasn't been run yet.
  if (error?.code === '42703') {
    ({ data, error } = await supabase
      .from('sotw_nominees')
      .select('week_start')
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle());
  }
  if (error) throw error;
  if (!data?.week_start) return null;
  return { weekStart: data.week_start, isTest: Boolean(data.is_test) };
}

async function getCurrentSotwWeekStart() {
  return (await getCurrentSotwWeek())?.weekStart ?? null;
}

// Whether voting is open for a list of nominees from getSotwNominees():
// the normal Friday 12am – Sunday 11:59pm window, or any time for a test week.
export function isSotwVotingOpenFor(nominees, now = new Date()) {
  if (nominees?.some((n) => n.sotwIsTest)) return true;
  return isSotwVotingOpen(now);
}

const nomineeScore = (p) => p.likes + p.comments * 2 + p.saves * 3;

// This week's finalists (up to 5), as feed posts (each with its live
// like count as `likes`, from posts.likes_count), ranked the same way the
// Friday job picked them. Each post carries the week it's a finalist for.
// Returns [] if the newest nominees are from a week whose result is already
// final and no new ones have been picked yet — there's nothing to vote on.
export async function getSotwNominees() {
  const current = await getCurrentSotwWeek();
  if (!current) return [];
  const { weekStart, isTest } = current;
  if (!isTest && isSotwWeekFinal(weekStart)) return [];

  const { data: nominees, error: nomineeError } = await supabase
    .from('sotw_nominees')
    .select('post_id')
    .eq('week_start', weekStart);
  if (nomineeError) throw nomineeError;
  const postIds = (nominees ?? []).map((n) => n.post_id).filter(Boolean);
  if (postIds.length === 0) return [];

  const { data: posts, error: postError } = await supabase
    .from('posts')
    .select('*, profiles!posts_user_id_profiles_fkey(username, full_name, avatar_url)')
    .in('id', postIds);
  if (postError) throw postError;

  return (posts ?? [])
    .map((row) => ({ ...mapPostRow(row), sotwWeekStart: weekStart, sotwIsTest: isTest }))
    .sort((a, b) => nomineeScore(b) - nomineeScore(a));
}

// Ids of the current week's finalists, for the "Finalist" badge on feed
// posts. Unlike getSotwNominees, this keeps returning last week's finalists
// after the vote is counted, until next Friday's nominees replace them.
export async function getSotwNomineeIds() {
  const weekStart = await getCurrentSotwWeekStart();
  if (!weekStart) return new Set();
  const { data, error } = await supabase
    .from('sotw_nominees')
    .select('post_id')
    .eq('week_start', weekStart);
  if (error) throw error;
  return new Set((data ?? []).map((n) => String(n.post_id)));
}

// The post the user voted for in the current week, or null.
export async function getSotwVote(userId) {
  if (!userId) return null;
  const weekStart = await getCurrentSotwWeekStart();
  if (!weekStart) return null;
  const { data, error } = await supabase
    .from('sotw_votes')
    .select('post_id')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();
  if (error) throw error;
  return data?.post_id ?? null;
}

// Casts (or changes) the user's one vote for the week this post is a
// finalist in. Upserts on the unique (user_id, week_start) key, so voting
// again that week moves the vote to the new post instead of adding a second
// one. RLS only accepts it for the user's own id and a real nominee.
export async function castSotwVote(userId, postId) {
  const { data: nominee, error: nomineeError } = await supabase
    .from('sotw_nominees')
    // '*' rather than naming is_test, so this still works before that
    // column's migration has been run.
    .select('*')
    .eq('post_id', postId)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (nomineeError) throw nomineeError;
  if (!nominee) throw new Error('This post is not a Shot of the Week finalist');

  // The database policy doesn't enforce the deadline, so refuse late votes
  // here: voting for a week ends at the end of its Sunday (11:59pm, the
  // user's local time) — week_start + 9 days, so the cutoff is 00:00 local
  // on the Monday after. Test weeks have no deadline.
  const [y, m, d] = String(nominee.week_start).split('-').map(Number);
  const votingClosesAt = new Date(y, m - 1, d + 10);
  if (!nominee.is_test && new Date() >= votingClosesAt) {
    const closedError = new Error('Voting has closed for this week');
    closedError.code = 'SOTW_VOTING_CLOSED';
    throw closedError;
  }

  const { error } = await supabase
    .from('sotw_votes')
    .upsert(
      { user_id: userId, post_id: postId, week_start: nominee.week_start, created_at: new Date().toISOString() },
      { onConflict: 'user_id,week_start' }
    );
  if (error) throw error;
}

// post_id -> vote count for the current week. Counted client-side — fine
// while there are only a handful of finalists and votes per week.
export async function getSotwVoteCounts() {
  const weekStart = await getCurrentSotwWeekStart();
  if (!weekStart) return {};
  const { data, error } = await supabase
    .from('sotw_votes')
    .select('post_id')
    .eq('week_start', weekStart);
  if (error) throw error;
  const counts = {};
  (data ?? []).forEach((v) => {
    counts[v.post_id] = (counts[v.post_id] ?? 0) + 1;
  });
  return counts;
}

// Reposts are never eligible: calculate_shot_of_week() and
// calculate_sotw_winner_from_votes() only read public.posts (original
// posts), and reposts live in their own public.reposts table, so a repost
// can't be nominated or win and reposts_count isn't in either formula.
//
// The current Shot of the Week, computed server-side by
// calculate_shot_of_week() (see supabase/schema.sql) and pinned to the top
// of the Feed pill until it's replaced the following Friday. Two queries
// (pointer row, then the post itself) rather than one embedded select so a
// post that's since been deleted (FK is `on delete cascade`, so this can't
// actually dangle, but a moderation-hidden post still counts) fails the
// second query cleanly instead of a join silently coming back empty.
// Every post that's ever been Shot of the Week — the profile grids' permanent
// trophy badge.
export async function getShotOfWeekPostIds() {
  const { data, error } = await supabase
    .from('shot_of_week')
    .select('post_id, week_start');
  if (error) throw error;
  // Stringified so .has(post.id) matches regardless of how the post id came
  // back (and an empty result is logged — the usual reason no trophies show
  // is that calculate_shot_of_week() has never written a row). A week that's
  // still being voted on is skipped: its row is only Friday's provisional
  // pick until the Monday vote count replaces it.
  const ids = new Set(
    (data ?? []).filter((r) => isSotwWeekFinal(r.week_start)).map((r) => String(r.post_id))
  );
  console.log('[shotOfWeek] trophy post ids loaded:', ids.size);
  return ids;
}

export async function getCurrentShotOfWeek() {
  // The newest row can be a week that's still being voted on (Friday's
  // provisional pick), so take the newest one whose result is final.
  const { data: shotRows, error: shotError } = await supabase
    .from('shot_of_week')
    .select('post_id, week_start')
    .order('created_at', { ascending: false })
    .limit(2);

  if (shotError) throw shotError;
  const shotData = (shotRows ?? []).find((r) => isSotwWeekFinal(r.week_start));
  if (!shotData?.post_id) return null;

  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('*, profiles!posts_user_id_profiles_fkey(username, full_name, avatar_url)')
    .eq('id', shotData.post_id)
    .maybeSingle();

  if (postError) throw postError;
  if (!post) return null;

  console.log('Shot of the week loaded:', post.id);
  return mapPostRow(post);
}
