import { getMyCourses } from './myCourses';

// A friend's own My Courses list (my_courses is publicly selectable via
// RLS, so this works for any userId) — used by the Map's friend view, which
// shows only the courses a friend has explicitly saved, not every course
// they've posted to or logged a score at.
export async function getFriendMyCourses(userId) {
  const rows = await getMyCourses(userId);
  return rows
    .filter((r) => r.latitude != null && r.longitude != null)
    .map((r) => ({
      id: r.courseId || r.id,
      name: r.courseName,
      city: r.city,
      state: r.state,
      lat: r.latitude,
      lng: r.longitude,
    }));
}
