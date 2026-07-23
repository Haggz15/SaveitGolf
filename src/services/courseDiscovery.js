import AsyncStorage from '@react-native-async-storage/async-storage';
import { searchCourses, hasBackgroundQuota, RateLimitError } from './golfCourseApi';
import { reverseGeocode, geocodeCourse } from './geocoding';

// golfcourseapi.com only supports text search (no lat/lng/radius param), so
// "find courses near this point" is implemented as:
//   reverse-geocode point -> city/state -> text-search that city name ->
//   forward-geocode each result -> cache by area so re-visiting doesn't
//   re-spend the shared 50/day quota.
const AREAS_KEY = 'saveitgolf.discoveredAreas.v1';
const COURSES_KEY = 'saveitgolf.discoveredCourses.v1';
const MAX_RESULTS_PER_AREA = 8;

let areasPromise = null;
let coursesPromise = null;

async function loadAreas() {
  if (!areasPromise) {
    areasPromise = AsyncStorage.getItem(AREAS_KEY).then((raw) => (raw ? JSON.parse(raw) : {}));
  }
  return areasPromise;
}

async function loadCourses() {
  if (!coursesPromise) {
    coursesPromise = AsyncStorage.getItem(COURSES_KEY).then((raw) => (raw ? JSON.parse(raw) : {}));
  }
  return coursesPromise;
}

async function persistAreas(areas) {
  await AsyncStorage.setItem(AREAS_KEY, JSON.stringify(areas));
}

async function persistCourses(courses) {
  await AsyncStorage.setItem(COURSES_KEY, JSON.stringify(courses));
}

export async function getAllDiscoveredCourses() {
  const courses = await loadCourses();
  return Object.values(courses);
}

function areaKeyFor(city, state) {
  return `${city ?? ''}|${state ?? ''}`.toLowerCase();
}

// Returns { courses, quotaExceeded, error } — courses is always an array
// (possibly empty), never throws for the expected failure modes.
export async function discoverCoursesNear(lat, lng) {
  let place;
  try {
    place = await reverseGeocode(lat, lng);
  } catch (err) {
    return { courses: [], quotaExceeded: false, error: err.message };
  }
  if (!place.city || !place.state) {
    return { courses: [], quotaExceeded: false, error: 'Could not resolve a city/state here' };
  }

  const key = areaKeyFor(place.city, place.state);
  const areas = await loadAreas();
  const allCourses = await loadCourses();

  if (areas[key]) {
    const existing = Object.values(allCourses).filter((c) => c.state === place.state);
    return { courses: existing, quotaExceeded: false };
  }

  const canProceed = await hasBackgroundQuota();
  if (!canProceed) {
    return { courses: [], quotaExceeded: true };
  }

  let results;
  try {
    results = await searchCourses(place.city);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { courses: [], quotaExceeded: true };
    }
    return { courses: [], quotaExceeded: false, error: err.message };
  }

  const matches = results
    .filter((c) => c.state?.toUpperCase() === place.state.toUpperCase())
    .slice(0, MAX_RESULTS_PER_AREA);

  const geocoded = [];
  for (const course of matches) {
    if (allCourses[course.id]) {
      geocoded.push(allCourses[course.id]);
      continue;
    }
    if (!course.address) continue;
    try {
      const coord = await geocodeCourse(course.id, course.address);
      const withCoord = { ...course, lat: coord.lat, lng: coord.lng };
      allCourses[course.id] = withCoord;
      geocoded.push(withCoord);
    } catch (err) {
      console.warn(`Could not geocode ${course.name}:`, err.message);
    }
  }

  areas[key] = { fetchedAt: Date.now() };
  await persistAreas(areas);
  await persistCourses(allCourses);

  const existingInState = Object.values(allCourses).filter((c) => c.state === place.state);
  return { courses: existingInState, quotaExceeded: false };
}
