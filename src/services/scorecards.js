import { supabase } from './supabase';
import { uploadToR2 } from './r2Storage';
import { escapeIlike } from '../utils/ilike';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Reshapes a `scorecards` row (flat `holes` array) back into the
// { front, back } shape the Scorecard screen renders.
function mapRow(row) {
  const holes = row.holes ?? [];
  const front = holes.filter((h) => h.hole <= 9);
  const back = holes.filter((h) => h.hole > 9);
  return {
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id,
    courseName: row.course_name,
    city: row.city,
    state: row.state,
    lat: row.lat,
    lng: row.lng,
    date: formatDate(row.played_at ?? row.created_at),
    front,
    ...(back.length ? { back } : {}),
    // The owner's manual overrides (Edit Score) win over the hole-by-hole
    // totals saved with the round.
    totalScore: row.manual_total ?? row.total_score,
    totalPar: row.manual_par ?? row.total_par,
    manualTotal: row.manual_total ?? null,
    manualPar: row.manual_par ?? null,
    photoUrl: row.photo_url ?? null,
    // The photo as first attached, before any Crop Photo — every crop starts
    // from this so the user can always widen the frame again. Null on rows
    // whose photo predates the column (their photo_url is the original).
    originalPhotoUrl: row.original_photo_url ?? null,
    compositeFront: row.composite_front ?? null,
    compositeBack: row.composite_back ?? null,
    pars: row.pars ? JSON.parse(row.pars) : null,
    // False when the course wasn't in the Golf Course API and `pars` is just
    // the default fallback pattern — the card then renders every hole score
    // as a plain number. Rows saved before the column existed fall back to
    // "had an API course id", since only those could have fetched real pars.
    parsKnown: row.pars_known ?? row.course_id != null,
    createdAt: row.created_at,
    // Which nine a 9-hole round was played on ('front' or 'back') — drives
    // whether the card labels its holes 1-9 or 10-18 and the single total
    // "Front"/"Back". Irrelevant (and always 'front') for 18-hole rounds.
    nineSide: row.nine_side ?? 'front',
    pinned: row.pinned ?? false,
    // Which of the two photo layouts ("side" or "behind") the attached
    // photo uses on the card — defaults to "behind" for any row saved
    // before this column existed.
    photoLayout: row.photo_layout ?? 'behind',
  };
}

export async function getScorecards(userId) {
  const { data, error } = await supabase
    .from('scorecards')
    .select('*')
    .eq('user_id', userId)
    .order('pinned', { ascending: false })
    .order('played_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getLatestScorecard(userId) {
  const { data, error } = await supabase
    .from('scorecards')
    .select('*')
    .eq('user_id', userId)
    .order('played_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRow(data) : null;
}

// `scorecard` comes from NewScorecardModal: { course, front, back?, ... }
// where `course` is the selected search result ({id, name, city, state, lat, lng})
// or a free-typed { id: null, name }. Scorecards are always created without a
// photo — one can be attached afterward via the Scorecard screen's green
// plus button, which uploads through `saveScorecardPhoto` below.
export async function saveScorecard(userId, scorecard) {
  const holes = [...scorecard.front, ...(scorecard.back ?? [])];
  const totalScore = holes.reduce((sum, h) => sum + h.score, 0);
  // Per-hole par came from the Golf Course API (or its default-pattern
  // fallback) back in NewScorecardModal — stored here only to drive the
  // over/under total, never displayed per-hole on the scorecard itself.
  const holePars = holes.map((h) => h.par);
  const totalPar = holePars.reduce((sum, p) => sum + p, 0) || (holes.length === 9 ? 36 : 72);

  const { data, error } = await supabase
    .from('scorecards')
    .insert({
      user_id: userId,
      course_id: scorecard.course?.id ?? null,
      course_name: scorecard.course?.name ?? 'Unknown course',
      city: scorecard.course?.city ?? null,
      state: scorecard.course?.state ?? null,
      lat: scorecard.course?.lat ?? null,
      lng: scorecard.course?.lng ?? null,
      holes_count: holes.length,
      holes,
      total_score: totalScore,
      total_par: totalPar,
      pars: JSON.stringify(holePars),
      photo_url: null,
      composite_front: scorecard.compositeFront ?? null,
      composite_back: scorecard.compositeBack ?? null,
      nine_side: scorecard.nineSide ?? 'front',
      pars_known: scorecard.parsKnown ?? scorecard.course?.id != null,
      photo_layout: 'behind',
    })
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
}

// Throws if nothing was deleted — RLS turns a delete the user isn't allowed
// to make into a silent no-op rather than an error.
export async function deleteScorecard(scorecardId) {
  const { data, error } = await supabase.from('scorecards').delete().eq('id', scorecardId).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Scorecard was not deleted.');
}

// Saves the owner's Edit Score overrides — total strokes and the course
// par the +/- is measured against. Returns the updated, mapped scorecard.
export async function updateScorecardScore(scorecardId, { manualTotal, manualPar }) {
  const { data, error } = await supabase
    .from('scorecards')
    .update({ manual_total: manualTotal, manual_par: manualPar })
    .eq('id', scorecardId)
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

// Only one scorecard can be pinned per user — pinning a new one clears the
// previous pin first. Unpinning just clears this row's own flag.
export async function setScorecardPinned(userId, scorecardId, pinned) {
  if (pinned) {
    const { error: unpinError } = await supabase
      .from('scorecards')
      .update({ pinned: false })
      .eq('user_id', userId);
    if (unpinError) throw unpinError;
  }

  const { error } = await supabase.from('scorecards').update({ pinned }).eq('id', scorecardId);
  if (error) throw error;
}

// Persists which of the two photo layouts ("side" or "behind") a
// scorecard's attached photo uses (Fix 5), so past scorecards render with
// the layout their owner last chose rather than always defaulting back to
// "behind".
export async function updateScorecardPhotoLayout(scorecardId, photoLayout) {
  const { error } = await supabase.from('scorecards').update({ photo_layout: photoLayout }).eq('id', scorecardId);
  if (error) throw error;
}

// Uploads a local photo uri (blob: on web, file:// from expo-image-picker on
// native) to the `scorecards` R2 bucket and stores the public URL on the
// row. Returns { photoUrl, originalPhotoUrl } so the caller can update the
// card immediately without refetching.
//
// A newly attached photo goes to `${scorecardId}.jpg` and becomes both
// photo_url and original_photo_url. A crop (`crop: true`) goes to its own
// `${scorecardId}_crop.jpg` object and only replaces photo_url, so the
// original stays untouched for the next crop. `originalPhotoUrl` is the
// photo the crop was cut from — stored as original_photo_url for rows that
// predate the column, whose existing photo_url is that original.
export async function saveScorecardPhoto(userId, scorecardId, uri, { crop = false, originalPhotoUrl = null } = {}) {
  const path = crop ? `${userId}/${scorecardId}_crop.jpg` : `${userId}/${scorecardId}.jpg`;

  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  // Every upload overwrites the same object, so version the URL — otherwise
  // a re-picked or cropped photo keeps showing the cached old one.
  const photoUrl = `${await uploadToR2('scorecards', path, arrayBuffer, 'image/jpeg')}?v=${Date.now()}`;
  const original = crop ? originalPhotoUrl : photoUrl;

  let { error: updateError } = await supabase
    .from('scorecards')
    .update(original ? { photo_url: photoUrl, original_photo_url: original } : { photo_url: photoUrl })
    .eq('id', scorecardId);
  // original_photo_url not migrated yet (see schema.sql) — still save the
  // photo itself rather than losing it.
  if (updateError && original && isMissingColumnError(updateError)) {
    console.warn('[scorecards] original_photo_url column missing — saving photo_url only');
    ({ error: updateError } = await supabase.from('scorecards').update({ photo_url: photoUrl }).eq('id', scorecardId));
  }
  if (updateError) throw updateError;

  return { photoUrl, originalPhotoUrl: original };
}

// PostgREST's "column not in schema cache" / Postgres's undefined_column.
function isMissingColumnError(error) {
  return error?.code === 'PGRST204' || error?.code === '42703';
}

// Points photo_url back at an already-uploaded URL (web's reposition of
// the original after a native crop) — nothing to upload.
export async function setScorecardPhotoUrl(scorecardId, photoUrl) {
  const { error } = await supabase.from('scorecards').update({ photo_url: photoUrl }).eq('id', scorecardId);
  if (error) throw error;
}

export const COURSE_SCORECARDS_PAGE_SIZE = 50;

// Scorecards logged at a given course, across every user, a page at a time,
// best score first — used by the Course Detail screen's Scorecards tab. Matches
// by course_id when available, otherwise a case-insensitive course_name
// match (scorecards.user_id has no FK to profiles, so names/avatars are
// fetched in a second query and merged in client-side). Returns
// { entries, hasMore }; the screen's Load more button asks for the next page
// with offset = entries shown so far.
export async function getScorecardsForCourse({ courseId, courseName, offset = 0, limit = COURSE_SCORECARDS_PAGE_SIZE }) {
  let request = supabase.from('scorecards').select('*');
  // Same identity rule as posts.js's fetchCourseRows: by course_id when
  // known, otherwise only id-less (hand-typed) scorecards with the exact
  // name, ignoring case — never another course's scorecards by name.
  request = courseId
    ? request.eq('course_id', courseId)
    : request.is('course_id', null).ilike('course_name', escapeIlike((courseName ?? '').trim()));
  // Best first: lowest score to par, so a 9-hole round doesn't outrank a
  // better 18 just for having fewer strokes; then lowest score. Both are
  // generated columns (schema.sql) that honor Edit Score's manual
  // overrides, so the database can rank and page. id keeps ties in a
  // stable order across pages. One extra row tells us whether there's more.
  request = request
    .order('score_to_par', { ascending: true })
    .order('display_score', { ascending: true })
    .order('id', { ascending: true })
    .range(offset, offset + limit);

  const { data, error } = await request;
  if (error) throw error;
  const hasMore = (data ?? []).length > limit;
  const rows = (data ?? []).slice(0, limit);

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  let profilesById = {};
  if (userIds.length) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, username, full_name, avatar_url')
      .in('user_id', userIds);
    if (profilesError) throw profilesError;
    profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p]));
  }

  const entries = rows.map((row) => {
    const profile = profilesById[row.user_id];
    const name = profile?.full_name || profile?.username || 'Golfer';
    return {
      id: row.id,
      userId: row.user_id,
      name,
      initials: name
        .split(' ')
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase(),
      avatarUrl: profile?.avatar_url ?? null,
      date: formatDate(row.played_at ?? row.created_at),
      score: row.manual_total ?? row.total_score,
      par: row.manual_par ?? row.total_par,
      // The full round, for CourseDetailScreen's tap-to-view scorecard.
      scorecard: mapRow(row),
    };
  });
  return { entries, hasMore };
}

// Best (lowest) score per course, top 5 lowest scores. No longer used by
// OtherUserProfileScreen (its tabs are Uploads/Course Rankings/Courses
// Played), kept for any other best-score-per-course use case.
export async function getTopCoursesForUser(userId) {
  const { data, error } = await supabase
    .from('scorecards')
    .select('course_id, course_name, total_score, total_par, manual_total, manual_par')
    .eq('user_id', userId);

  if (error) throw error;

  const bestByCourse = new Map();
  for (const raw of data ?? []) {
    const row = {
      ...raw,
      total_score: raw.manual_total ?? raw.total_score,
      total_par: raw.manual_par ?? raw.total_par,
    };
    const key = row.course_id || row.course_name;
    const existing = bestByCourse.get(key);
    if (!existing || row.total_score < existing.bestScore) {
      bestByCourse.set(key, {
        courseId: row.course_id,
        courseName: row.course_name,
        bestScore: row.total_score,
        par: row.total_par,
      });
    }
  }

  return Array.from(bestByCourse.values())
    .sort((a, b) => (a.bestScore - a.par) - (b.bestScore - b.par) || a.bestScore - b.bestScore)
    .slice(0, 5)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
