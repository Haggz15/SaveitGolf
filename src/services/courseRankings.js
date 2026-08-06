import { supabase } from './supabase';

function mapRow(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    courseName: row.course_name,
    rating: Number(row.rating),
  };
}

export async function getCourseRankings(userId) {
  const { data, error } = await supabase
    .from('course_rankings')
    .select('*')
    .eq('user_id', userId)
    .order('rating', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapRow);
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

// Average rating across every user who's ranked this course — used by the
// Course Detail screen's stats bar. Returns null (rather than 0) when no one
// has ranked it yet, so the UI can omit the stat instead of showing a fake 0.
export async function getAverageRatingForCourse({ courseId, courseName }) {
  let request = supabase.from('course_rankings').select('rating');
  request = courseId ? request.eq('course_id', courseId) : request.ilike('course_name', courseName ?? '');

  const { data, error } = await request;
  if (error) throw error;
  const ratings = (data ?? []).map((r) => Number(r.rating));
  if (!ratings.length) return null;
  return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
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
