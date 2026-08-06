import { supabase } from './supabase';

function addUnique(byKey, row) {
  if (row.lat == null || row.lng == null) return;
  const key = row.course_id || row.course_name;
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
    supabase
      .from('posts')
      .select('course_id, course_name, city, state, lat, lng')
      .eq('state', stateAbbr)
      .not('lat', 'is', null),
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

  return Array.from(byKey.values());
}
