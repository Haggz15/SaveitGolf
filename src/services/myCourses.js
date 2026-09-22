import { supabase } from './supabase';
import { addUnrankedCourseRanking } from './courseRankings';

function mapRow(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    courseName: row.course_name,
    city: row.city,
    state: row.state,
    latitude: row.latitude,
    longitude: row.longitude,
    sortOrder: row.sort_order ?? 0,
  };
}

// Ordered by sort_order (the user's own drag/arrow-reordered position — see
// ProfileScreen's Courses Played tab), falling back to most-recently-added
// first among rows that still share the same default sort_order of 0 (i.e.
// before the user has ever reordered anything).
export async function getMyCourses(userId) {
  const { data, error } = await supabase
    .from('my_courses')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

// Persists a full reordering of the user's Courses Played list — called with
// every row (not just the two swapped) since a plain index-based swap
// doesn't know which rows already had distinct sort_order values.
export async function updateMyCoursesOrder(courses) {
  await Promise.all(
    courses.map((course, index) => supabase.from('my_courses').update({ sort_order: index }).eq('id', course.id))
  );
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

  // Fire-and-forget: addUnrankedCourseRanking swallows its own errors (a
  // ranking row is a convenience, not something that should ever fail or
  // delay the Courses Played save itself).
  addUnrankedCourseRanking(userId, { courseId: courseId ?? null, courseName });

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

// Auto-adds a course to My Courses the first time a user posts to it, so
// Courses Played reflects everywhere they've actually played without an
// extra manual "Add course" step. Looked up by course_name rather than
// course_id since a manually-typed post (no golfcourseapi.com match) has no
// id to key off of, and the my_courses_user_course_idx unique index only
// dedupes on (user_id, course_id) — this covers the null-course_id case that
// index intentionally leaves alone.
export async function addCourseFromPost(userId, course) {
  if (!userId || !course?.name) return;
  const { data: existing, error: lookupError } = await supabase
    .from('my_courses')
    .select('id')
    .eq('user_id', userId)
    .eq('course_name', course.name)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    console.error('[myCourses] addCourseFromPost lookup failed:', lookupError);
    return;
  }
  if (existing) return;

  await addMyCourse(userId, {
    courseId: course.id ?? null,
    courseName: course.name,
    city: course.city ?? null,
    state: course.state ?? null,
    latitude: course.lat ?? null,
    longitude: course.lng ?? null,
  });
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
