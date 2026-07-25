import { seedCoursesByState } from './courses';

// Mock "played" tracking for the map's Courses I've Played filter. There's no
// round-history backend wired to the map's course ids yet (those come from
// golfcourseapi.com, a different id space than the feed's mock courses), so
// this seeds a few states' courses as played to demo the filter in dev.
const PLAYED_STATE_ABBRS = ['CA', 'GA', 'OR', 'WI'];

export const playedCourseIds = new Set(
  PLAYED_STATE_ABBRS.map((abbr) => seedCoursesByState[abbr]?.id).filter(Boolean)
);

export function isCoursePlayed(courseId) {
  return playedCourseIds.has(courseId);
}
