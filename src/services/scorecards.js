import { supabase } from './supabase';

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
    totalScore: row.total_score,
    totalPar: row.total_par,
    photoUrl: row.photo_url ?? null,
    compositeFront: row.composite_front ?? null,
    compositeBack: row.composite_back ?? null,
    pars: row.pars ? JSON.parse(row.pars) : null,
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
      photo_layout: 'behind',
    })
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function deleteScorecard(scorecardId) {
  const { error } = await supabase.from('scorecards').delete().eq('id', scorecardId);
  if (error) throw error;
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
// native) to the `scorecards` storage bucket at a fixed per-scorecard path,
// overwriting any photo already attached to that scorecard, then stores the
// public URL on the row. Returns the public URL so the caller can update the
// card immediately without refetching.
export async function saveScorecardPhoto(userId, scorecardId, uri) {
  const path = `${userId}/${scorecardId}.jpg`;

  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('scorecards')
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from('scorecards').getPublicUrl(path);
  const photoUrl = publicUrlData.publicUrl;

  const { error: updateError } = await supabase
    .from('scorecards')
    .update({ photo_url: photoUrl })
    .eq('id', scorecardId);
  if (updateError) throw updateError;

  return photoUrl;
}

// All scorecards logged at a given course, across every user, sorted lowest
// score first — used by the Course Detail screen's Scorecards tab. Matches
// by course_id when available, otherwise a case-insensitive course_name
// match (scorecards.user_id has no FK to profiles, so names/avatars are
// fetched in a second query and merged in client-side).
export async function getScorecardsForCourse({ courseId, courseName }) {
  let request = supabase.from('scorecards').select('*');
  request = courseId ? request.eq('course_id', courseId) : request.ilike('course_name', courseName ?? '');
  request = request.order('total_score', { ascending: true });

  const { data, error } = await request;
  if (error) throw error;
  const rows = data ?? [];

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

  return rows.map((row) => {
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
      score: row.total_score,
      par: row.total_par,
    };
  });
}

// Best (lowest) score per course, top 5 lowest scores. No longer used by
// OtherUserProfileScreen (its tabs are Uploads/Course Rankings/Courses
// Played), kept for any other best-score-per-course use case.
export async function getTopCoursesForUser(userId) {
  const { data, error } = await supabase
    .from('scorecards')
    .select('course_id, course_name, total_score, total_par')
    .eq('user_id', userId);

  if (error) throw error;

  const bestByCourse = new Map();
  for (const row of data ?? []) {
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
