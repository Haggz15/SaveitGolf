import { supabase } from './supabase';
import { addUnrankedCourseRanking } from './courseRankings';
import { escapeIlike } from '../utils/ilike';
import { getCourseLocation } from './courseLocations';
import { geocodeCourseCoordinates } from './geocoding';
import { submitNewCourse } from './golfCourseApi';

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

// Ordered by sort_order (the position the user once arrow-reordered it to,
// before Courses Played was sorted by ranking), falling back to
// most-recently-added first among rows that share the default sort_order of
// 0. ProfileScreen's Courses Played lists unranked courses in this order.
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

  // Awaited so callers can refetch rankings straight after, but
  // addUnrankedCourseRanking swallows its own errors (a ranking row is a
  // convenience, never something that should fail the Courses Played save).
  await addUnrankedCourseRanking(userId, { courseId: courseId ?? null, courseName });

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

// Adds a CourseSearchModal search result to Courses Played — shared by the
// Profile tab and the map's "Played X courses" dropdown. golfcourseapi.com
// search results frequently omit coordinates, so this first reuses another
// my_courses row's coordinates for the same course (the table is
// world-readable, see schema.sql), and only falls back to a fresh Nominatim
// lookup if there are none, so a shared course never spends the 1 req/sec
// Nominatim budget twice. Geocoding failure never blocks the save.
export async function addSearchedCourse(userId, course) {
  let latitude = course.lat;
  let longitude = course.lng;

  if (latitude == null || longitude == null) {
    const saved = course.id
      ? await getSavedCourseCoordinates(course.id).catch((err) => {
          console.log('[myCourses] addSearchedCourse: getSavedCourseCoordinates failed:', err.message);
          return null;
        })
      : null;
    const coords =
      saved ??
      (await geocodeCourseCoordinates(course).catch((err) => {
        console.log('[myCourses] addSearchedCourse: geocoding threw, saving without coordinates:', err.message);
        return null;
      }));
    latitude = coords?.lat ?? null;
    longitude = coords?.lng ?? null;
  }

  return addMyCourse(userId, {
    courseId: course.id,
    courseName: course.name,
    city: course.city,
    state: course.state,
    latitude,
    longitude,
  });
}

// A course search came up empty in golfcourseapi.com, so the user typed it
// in themselves. The my_courses save is awaited normally; submitting the
// course to golfcourseapi.com so it's findable for everyone else is fired
// off alongside it and never blocks or surfaces its own errors.
export async function addManualCourse(userId, { name, city, state }) {
  // Same as addSearchedCourse: geocoding failure must never block the save.
  const coords = await geocodeCourseCoordinates({
    id: `manual-${name}-${city}-${state}`,
    name,
    city,
    state,
  }).catch((err) => {
    console.log('[myCourses] addManualCourse: geocoding threw, saving without coordinates:', err.message);
    return null;
  });
  const latitude = coords?.lat ?? null;
  const longitude = coords?.lng ?? null;

  submitNewCourse({ name, city, state, lat: latitude, lng: longitude })
    .then((result) => console.log('[golfcourseapi] submitted manually-added course:', result))
    .catch((err) => console.error('[golfcourseapi] failed to submit manually-added course:', err.message));

  return addMyCourse(userId, { courseId: null, courseName: name, city, state, latitude, longitude });
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
