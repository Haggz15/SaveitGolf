import { getCourseById } from '../services/golfCourseApi';

// Course rows sourced from course_rankings carry no city/state/lat/lng (see
// courseRankings.js's mapRow) — enrich via golfcourseapi.com when a courseId
// is available so the map's "View on Map" flow has a state to zoom to and a
// name/city/state to geocode against (see useCourseMapData's
// routeZoomToState handling). Rows that already have a city/state (e.g. from
// my_courses) are returned as-is, and a manually-entered ranking with no
// courseId at all is returned unchanged too — the map flow degrades to a
// state-less popup with no pin, same as any other course it can't locate.
async function resolveCourseLocation(course) {
  if (course.city && course.state) return course;
  if (!course.courseId) return course;
  try {
    const detail = await getCourseById(course.courseId);
    return {
      ...course,
      city: course.city ?? detail.city,
      state: course.state ?? detail.state,
      lat: course.lat ?? detail.lat,
      lng: course.lng ?? detail.lng,
    };
  } catch (err) {
    console.error(`[courseNavigation] failed to resolve location for "${course.courseName}":`, err.message);
    return course;
  }
}

// Mirrors FeedScreen.handleCoursePress exactly: zoom out to the course's
// whole state, then zoom in tight on the course itself with the flag pin and
// auto-navigate countdown once coordinates are resolved (see
// useCourseMapData's routeZoomToState effect). `viaTabs` is true for screens
// that live outside the bottom Tab navigator (e.g. OtherUserProfileScreen,
// a root-level stack screen) and false for screens nested inside it (e.g.
// the user's own ProfileScreen), matching FeedScreen's own navigateToMap.
export async function navigateToCourseOnMap(navigation, { viaTabs, course }) {
  const resolved = await resolveCourseLocation(course);
  const params = {
    zoomToState: {
      postId: null,
      courseId: resolved.courseId ?? null,
      courseName: resolved.courseName,
      city: resolved.city ?? null,
      state: resolved.state ?? null,
      lat: resolved.lat ?? null,
      lng: resolved.lng ?? null,
    },
    zoomToStateAt: Date.now(),
  };
  if (viaTabs) {
    navigation.navigate('Tabs', { screen: 'Map', params });
  } else {
    navigation.navigate('Map', params);
  }
}

export function navigateToCourseDetail(navigation, course) {
  navigation.navigate('CourseDetail', {
    courseId: course.courseId ?? null,
    courseName: course.courseName,
    city: course.city ?? null,
    state: course.state ?? null,
  });
}
