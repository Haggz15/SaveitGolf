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
    console.log(`[courseDiscovery] "${key}" already fetched, ${existing.length} cached course(s)`);
    return { courses: existing, quotaExceeded: false };
  }

  const canProceed = await hasBackgroundQuota();
  if (!canProceed) {
    console.warn(`[courseDiscovery] skipping "${key}" — background quota exhausted`);
    return { courses: [], quotaExceeded: true };
  }

  let results;
  try {
    results = await searchCourses(place.city);
    console.log(`[courseDiscovery] search("${place.city}") -> ${results.length} result(s)`);
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.warn(`[courseDiscovery] rate limited searching "${place.city}"`);
      return { courses: [], quotaExceeded: true };
    }
    console.error(`[courseDiscovery] search("${place.city}") failed:`, err.message);
    return { courses: [], quotaExceeded: false, error: err.message };
  }

  const matches = results
    .filter((c) => c.state?.toUpperCase() === place.state.toUpperCase())
    .slice(0, MAX_RESULTS_PER_AREA);
  console.log(`[courseDiscovery] ${matches.length} of ${results.length} result(s) matched state ${place.state}`);

  const geocoded = [];
  for (const course of matches) {
    if (allCourses[course.id]) {
      geocoded.push(allCourses[course.id]);
      continue;
    }
    if (course.lat != null && course.lng != null) {
      allCourses[course.id] = course;
      geocoded.push(course);
      continue;
    }
    if (!course.address) continue;
    try {
      const coord = await geocodeCourse(course.id, course.address, {
        name: course.name,
        city: course.city,
        state: course.state,
      });
      const withCoord = { ...course, lat: coord.lat, lng: coord.lng };
      allCourses[course.id] = withCoord;
      geocoded.push(withCoord);
    } catch (err) {
      console.warn(`[courseDiscovery] could not geocode ${course.name}:`, err.message);
    }
  }

  areas[key] = { fetchedAt: Date.now() };
  await persistAreas(areas);
  await persistCourses(allCourses);

  const existingInState = Object.values(allCourses).filter((c) => c.state === place.state);
  return { courses: existingInState, quotaExceeded: false };
}

const STATE_SWEEP_KEY = 'saveitgolf.stateSweepDone.v1';
const STATE_REQUEST_DELAY_MS = 500;

let stateSweepPromise = null;

async function loadStateSweep() {
  if (!stateSweepPromise) {
    stateSweepPromise = AsyncStorage.getItem(STATE_SWEEP_KEY).then((raw) => (raw ? JSON.parse(raw) : {}));
  }
  return stateSweepPromise;
}

async function persistStateSweep(done) {
  await AsyncStorage.setItem(STATE_SWEEP_KEY, JSON.stringify(done));
}

// Sweeps every US state with a dedicated "golf courses <state name>" search
// so the map has real courses everywhere up front, not just wherever the
// user has panned or gotten a location fix. One request per state, spaced
// 500ms apart to stay gentle on the API. Which states are already done is
// persisted so relaunching the app doesn't re-spend the shared 50/day quota
// re-sweeping states already covered — an interrupted sweep (quota exhausted
// partway through) simply resumes with the remaining states next session.
export async function sweepAllStates(stateAbbrToName, onStateCourses) {
  const done = await loadStateSweep();
  const allCourses = await loadCourses();
  const pending = Object.keys(stateAbbrToName).filter((abbr) => !done[abbr]);

  for (const abbr of pending) {
    const canProceed = await hasBackgroundQuota();
    if (!canProceed) {
      console.warn('[courseDiscovery] state sweep paused — background quota exhausted');
      return { quotaExceeded: true };
    }

    const stateName = stateAbbrToName[abbr];
    try {
      const results = await searchCourses(`golf courses ${stateName}`);
      const matches = results.filter((c) => c.state?.toUpperCase() === abbr);
      console.log(`[courseDiscovery] state sweep "${stateName}" -> ${matches.length} of ${results.length} matched ${abbr}`);

      matches.forEach((c) => {
        allCourses[c.id] = c;
      });
      if (matches.length) {
        await persistCourses(allCourses);
        onStateCourses?.(matches);
      }
      done[abbr] = true;
      await persistStateSweep(done);
    } catch (err) {
      if (err instanceof RateLimitError) {
        console.warn(`[courseDiscovery] state sweep rate limited on ${abbr}`);
        return { quotaExceeded: true };
      }
      console.error(`[courseDiscovery] state sweep failed for ${abbr}:`, err.message);
      // Not marked done — retried on the next sweep instead of skipped forever.
    }

    await new Promise((resolve) => setTimeout(resolve, STATE_REQUEST_DELAY_MS));
  }

  return { quotaExceeded: false };
}
