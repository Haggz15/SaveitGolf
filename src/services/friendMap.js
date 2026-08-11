import { getMyCourses, getSavedCourseCoordinates, updateMyCourseCoordinates } from './myCourses';
import { geocodeCourseCoordinates } from './geocoding';

// A friend's own My Courses list (my_courses is publicly selectable via
// RLS, so this works for any userId) — used by the Map's friend view, which
// shows only the courses a friend has explicitly saved, not every course
// they've posted to or logged a score at. Mirrors useCourseMapData's own
// my_courses-loading effect: a row saved without coordinates (or whose
// address didn't geocode at save time) is geocoded here via Nominatim rather
// than being dropped, checking for another user's already-geocoded row for
// the same course first so the shared 1 req/sec Nominatim budget isn't spent
// twice. Persisting the result back to the row is best-effort — the update
// RLS policy only allows the course's owner to write it, so this silently
// no-ops when viewing someone else's courses and the course is simply
// re-geocoded next time.
export async function getFriendMyCourses(userId) {
  const rows = await getMyCourses(userId);
  const withCoords = [];
  for (const r of rows) {
    let lat = r.latitude;
    let lng = r.longitude;
    if (lat == null || lng == null) {
      const saved = r.courseId ? await getSavedCourseCoordinates(r.courseId).catch(() => null) : null;
      const coords =
        saved ??
        (await geocodeCourseCoordinates({
          id: r.courseId || r.id,
          name: r.courseName,
          city: r.city,
          state: r.state,
        }).catch(() => null));
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
        updateMyCourseCoordinates(r.id, { latitude: lat, longitude: lng }).catch((err) =>
          console.error(`[friendMap] failed to persist geocoded coordinates for "${r.courseName}":`, err.message)
        );
      }
    }
    if (lat != null && lng != null) {
      withCoords.push({ id: r.courseId || r.id, name: r.courseName, city: r.city, state: r.state, lat, lng });
    }
  }
  return withCoords;
}
