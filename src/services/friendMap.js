import { getCoursesPostedByUser } from './posts';
import { getCoursesLoggedByUser } from './scorecards';

// Distinct courses a user has either posted content to or logged a
// scorecard at — used to drop pins on the Map's "Search Friends" view.
export async function getFriendPlayedCourses(userId) {
  const [posted, logged] = await Promise.all([
    getCoursesPostedByUser(userId),
    getCoursesLoggedByUser(userId),
  ]);

  const byKey = new Map();
  for (const row of [...posted, ...logged]) {
    if (row.lat == null || row.lng == null) continue;
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

  return Array.from(byKey.values());
}
