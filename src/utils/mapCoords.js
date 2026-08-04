// Single source of truth for "is this a placeable map coordinate" — used by
// golfCourseApi's normalization, useCourseMapData's filtering, and both map
// screens' render-time defense. golfcourseapi.com frequently omits
// location.latitude/longitude for a course, and Leaflet/react-native-maps
// crash (not just render blank) when handed a null/NaN/out-of-range
// coordinate, so every source of course data funnels through this check.
export function hasValidCoordinates(lat, lng) {
  if (lat == null || lng == null) return false;
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (isNaN(numLat) || isNaN(numLng)) return false;
  if (numLat < -90 || numLat > 90) return false;
  if (numLng < -180 || numLng > 180) return false;
  return true;
}

export function courseHasValidCoordinates(course) {
  return !!course && hasValidCoordinates(course.lat, course.lng);
}

// Filters a course list down to ones with placeable coordinates, logging how
// many were skipped (with id/name so a bad course can be traced back to the
// API response) so the scale of the golfcourseapi.com data-quality issue is
// visible instead of silently dropping pins.
export function filterCoursesWithValidCoordinates(courses, context = '') {
  const valid = [];
  const skipped = [];
  for (const course of courses) {
    if (courseHasValidCoordinates(course)) {
      valid.push(course);
    } else {
      skipped.push(course);
    }
  }
  if (skipped.length > 0) {
    console.warn(
      `[mapCoords]${context ? ` ${context}:` : ''} skipped ${skipped.length} of ${courses.length} course(s) with invalid/missing coordinates`,
      skipped.map((c) => ({ id: c.id, name: c.name, lat: c.lat, lng: c.lng }))
    );
  }
  return valid;
}
