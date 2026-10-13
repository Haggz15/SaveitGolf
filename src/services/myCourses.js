import { supabase } from './supabase';
import { addUnrankedCourseRanking } from './courseRankings';
import { escapeIlike } from '../utils/ilike';
import { getCourseLocation } from './courseLocations';

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
    createdAt: row.created_at,
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

// The user's existing my_courses row for this course, if any. A real
// golfcourseapi.com course is identified by course_id alone (names can
// differ between a search result and an older row for the same course); a
// hand-typed course has no id, so it's matched by name, ignoring case, among
// the user's other id-less rows — "Torrey Pines" and "torrey pines" are the
// same course, but a typed name never collapses into an API course.
async function findExistingMyCourse(userId, { courseId, courseName }) {
  let query = supabase.from('my_courses').select('*').eq('user_id', userId);
  query = courseId
    ? query.eq('course_id', courseId)
    : query.is('course_id', null).ilike('course_name', escapeIlike(courseName.trim()));
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

// Inserts a Courses Played row, or returns the user's existing row for the
// same course unchanged (see findExistingMyCourse) — callers can treat the
// result the same either way.
export async function addMyCourse(userId, { courseId, courseName, city, state, latitude, longitude }) {
  const existing = await findExistingMyCourse(userId, { courseId, courseName });
  if (existing) return mapRow(existing);

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

  if (error) {
    console.error('[myCourses] addMyCourse insert failed:', error);
    throw error;
  }

  // Fire-and-forget: addUnrankedCourseRanking swallows its own errors (a
  // ranking row is a convenience, not something that should ever fail or
  // delay the Courses Played save itself).
  addUnrankedCourseRanking(userId, { courseId: courseId ?? null, courseName });

  return mapRow(data);
}

// The my_courses select policy is world-readable (see schema.sql), so any
// user who already geocoded a given course leaves usable coordinates behind
// for the next person to add it — checking here before hitting Nominatim
// saves a request against its shared 1 req/sec budget. A hand-typed course
// (no courseId) has nothing to share by id, so it uses the pin someone
// dropped for it by name instead (see courseLocations.js), if any — never a
// Nominatim name lookup's guess.
export async function getSavedCourseCoordinates(courseId, courseName = null) {
  if (!courseId) {
    const pinned = await getCourseLocation(courseName);
    return pinned ? { lat: pinned.lat, lng: pinned.lng } : null;
  }
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
// extra manual "Add course" step. addMyCourse skips the insert when the
// course is already there (by course_id, or by case-insensitive name for a
// hand-typed course with no id).
export async function addCourseFromPost(userId, course) {
  if (!userId || !course?.name) return;
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
