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
// or a free-typed { id: null, name }.
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
    })
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
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

// Distinct courses a user has logged a scorecard at — used by the Map's
// "Search Friends" pins.
export async function getCoursesLoggedByUser(userId) {
  const { data, error } = await supabase
    .from('scorecards')
    .select('course_id, course_name, city, state, lat, lng')
    .eq('user_id', userId)
    .not('lat', 'is', null);

  if (error) throw error;
  return data ?? [];
}
