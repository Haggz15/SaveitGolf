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
