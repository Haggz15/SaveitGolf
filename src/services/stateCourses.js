import { supabase } from './supabase';

// Keyed by course_id when there is one. Hand-typed (id-less) rows are keyed
// by name ignoring case, so case variants of one name share a pin.
function addUnique(byKey, row) {
  if (row.lat == null || row.lng == null) return;
  const key = row.course_id || row.course_name?.trim().toLowerCase();
  if (!key) return;
  if (!byKey.has(key)) {
    byKey.set(key, {
      id: row.course_id || `course-${key}`,
      name: row.course_name,
      city: row.city,
      state: row.state,
      lat: row.lat,
      lng: row.lng,
    });
  }
}

// Every course this app knows about in a given state — the union of what
// any user has saved to My Courses, posted to, or logged a scorecard for.
// Used by the map's "All Courses" toggle in place of golfcourseapi.com's
// state-name search, which returns unreliable/mismatched results.
export async function getAllCoursesInState(stateAbbr) {
  if (!stateAbbr) return [];

  const [myCoursesRes, postsRes, scorecardsRes] = await Promise.all([
    supabase
      .from('my_courses')
      .select('course_id, course_name, city, state, latitude, longitude')
      .eq('state', stateAbbr)
      .not('latitude', 'is', null),
    // One row per course rather than per post — see the course_post_locations
    // view in schema.sql.
    supabase
      .from('course_post_locations')
      .select('course_id, course_name, city, state, lat, lng')
      .eq('state', stateAbbr),
    supabase
      .from('scorecards')
      .select('course_id, course_name, city, state, lat, lng')
      .eq('state', stateAbbr)
      .not('lat', 'is', null),
  ]);

  if (myCoursesRes.error) throw myCoursesRes.error;
  if (postsRes.error) throw postsRes.error;
  if (scorecardsRes.error) throw scorecardsRes.error;

  const byKey = new Map();
  for (const row of myCoursesRes.data ?? []) {
    addUnique(byKey, { ...row, lat: row.latitude, lng: row.longitude });
  }
  for (const row of [...(postsRes.data ?? []), ...(scorecardsRes.data ?? [])]) {
    addUnique(byKey, row);
  }

  // A hand-typed row named the same as an API course is that course, so it
  // shouldn't get a second pin of its own wherever its typed name geocoded.
  const apiNames = new Set(
    Array.from(byKey.entries())
      .filter(([key, c]) => key === c.id)
      .map(([, c]) => c.name?.trim().toLowerCase())
  );
  return Array.from(byKey.entries())
    .filter(([key, c]) => key === c.id || !apiNames.has(key))
    .map(([, c]) => c);
}
