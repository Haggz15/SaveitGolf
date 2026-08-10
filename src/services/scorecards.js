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
    createdAt: row.created_at,
  };
}

export async function getScorecards(userId) {
  const { data, error } = await supabase
    .from('scorecards')
    .select('*')
    .eq('user_id', userId)
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
// or a free-typed { id: null, name }. `photoUri` is the optional photo
// attached on the Scorecard screen before saving.
export async function saveScorecard(userId, scorecard) {
  const holes = [...scorecard.front, ...(scorecard.back ?? [])];
  const totalScore = holes.reduce((sum, h) => sum + h.score, 0);
  const totalPar = holes.reduce((sum, h) => sum + h.par, 0);

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
      photo_url: scorecard.photoUri ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
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

// Best (lowest) score per course, top 5 lowest scores — used by the Other
// User Profile screen's "Top Courses" tab.
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
