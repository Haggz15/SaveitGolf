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

// Mirrors addCourseRanking's shape exactly (see courseRankings.js): a plain
// insert, no pre-check, no upsert. The one structural difference is the
// extra city/state/latitude/longitude columns this table has and
// course_rankings doesn't.
export async function addMyCourse(userId, { courseId, courseName, city, state, latitude, longitude }) {
  console.log('[myCourses] addMyCourse called with userId:', userId, {
    courseId,
    courseName,
    city,
    state,
    latitude,
    longitude,
  });

  const { data, error } = await supabase
    .from('my_courses')
    .insert({
      user_id: userId,
      course_id: courseId ?? null,
      course_name: courseName,
      city: city ?? null,
      state: state ?? null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    })
    .select()
    .single();

  console.log('[myCourses] addMyCourse response:', { data, error });

  if (error) {
    console.error('[myCourses] addMyCourse insert failed:', error);
    throw error;
  }

  console.log('[myCourses] addMyCourse succeeded, row id:', data.id);
  return mapRow(data);
}

// The my_courses select policy is world-readable (see schema.sql), so any
// user who already geocoded a given course leaves usable coordinates behind
// for the next person to add it — checking here before hitting Nominatim
// saves a request against its shared 1 req/sec budget.
export async function getSavedCourseCoordinates(courseId) {
  if (!courseId) return null;
  const { data, error } = await supabase
    .from('my_courses')
    .select('latitude, longitude')
    .eq('course_id', courseId)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? { lat: data.latitude, lng: data.longitude } : null;
}

export async function removeMyCourse(id) {
  const { error } = await supabase.from('my_courses').delete().eq('id', id);
  if (error) throw error;
}

// Backfills lat/lng on a row that was saved before it had coordinates (or
// whose address couldn't be geocoded at save time) so the map only has to
// geocode it once — subsequent loads read the stored value straight away.
export async function updateMyCourseCoordinates(id, { latitude, longitude }) {
  const { error } = await supabase.from('my_courses').update({ latitude, longitude }).eq('id', id);
  if (error) throw error;
}
