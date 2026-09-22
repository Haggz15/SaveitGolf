import { supabase } from './supabase';

function mapRow(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    courseName: row.course_name,
    // Unranked rows (see addUnrankedCourseRanking) carry a null rating —
    // Number(null) would coerce that to 0 and hide them as a real ranking.
    rating: row.rating == null ? null : Number(row.rating),
  };
}

export async function getCourseRankings(userId) {
  const { data, error } = await supabase
    .from('course_rankings')
    .select('*')
    .eq('user_id', userId)
    // Nulls (unranked) sort last so they land at the bottom of the tab
    // instead of Postgres's default of nulls-first on a descending order.
    .order('rating', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

// Auto-adds a course to Course Rankings with no rating yet, the first time
// it's added to Courses Played (see myCourses.js's addMyCourse) — so it
// shows up in the Rankings tab as an unranked prompt instead of requiring a
// separate manual step. Looked up by course_name, matching addCourseFromPost's
// dedupe key in myCourses.js.
export async function addUnrankedCourseRanking(userId, { courseId, courseName }) {
  if (!userId || !courseName) return;
  const { data: existing, error: lookupError } = await supabase
    .from('course_rankings')
    .select('id')
    .eq('user_id', userId)
    .eq('course_name', courseName)
    .maybeSingle();

  if (lookupError) {
    console.error('[courseRankings] addUnrankedCourseRanking lookup failed:', lookupError);
    return;
  }
  if (existing) return;

  const { error } = await supabase
    .from('course_rankings')
    .insert({ user_id: userId, course_id: courseId ?? null, course_name: courseName, rating: null });

  if (error) console.error('[courseRankings] addUnrankedCourseRanking insert failed:', error);
}

export async function addCourseRanking(userId, { courseId, courseName, rating }) {
  const { data, error } = await supabase
    .from('course_rankings')
    .insert({ user_id: userId, course_id: courseId ?? null, course_name: courseName, rating })
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function updateCourseRanking(id, { courseName, rating }) {
  const { data, error } = await supabase
    .from('course_rankings')
    .update({ course_name: courseName, rating })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
}
