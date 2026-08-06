import { supabase } from './supabase';

function mapRow(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    courseName: row.course_name,
    city: row.city,
    state: row.state,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

export async function getMyCourses(userId) {
  const { data, error } = await supabase
    .from('my_courses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function addMyCourse(userId, { courseId, courseName, city, state, latitude, longitude }) {
  console.log('[myCourses] addMyCourse user_id:', userId);

  const { data, error } = await supabase
    .from('my_courses')
    .upsert(
      {
        user_id: userId,
        course_id: courseId ?? null,
        course_name: courseName,
        city: city ?? null,
        state: state ?? null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      },
      { onConflict: 'user_id,course_id' }
    )
    .select()
    .single();

  console.log('[myCourses] addMyCourse response:', { data, error });

  if (error) throw error;
  return mapRow(data);
}

export async function removeMyCourse(id) {
  const { error } = await supabase.from('my_courses').delete().eq('id', id);
  if (error) throw error;
}
