import AsyncStorage from '@react-native-async-storage/async-storage';

// Persists the full course list for a state once fetched via golfcourseapi.com's
// search endpoint (search_query=<state name>), so zooming out and back into a
// state doesn't re-spend the shared daily quota. Distinct from
// services/geocoding.js's per-course geocode cache and the old area-based
// services/courseDiscovery.js cache, both of which this map system replaces.
const CACHE_KEY = 'saveitgolf.stateCourses.v1';

let cachePromise = null;

async function loadCache() {
  if (!cachePromise) {
    cachePromise = AsyncStorage.getItem(CACHE_KEY).then((raw) => (raw ? JSON.parse(raw) : {}));
  }
  return cachePromise;
}

async function persistCache(cache) {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

// Returns the cached course list for a state abbreviation, or null if that
// state has never been fetched.
export async function getCachedStateCourses(abbr) {
  const cache = await loadCache();
  return cache[abbr]?.courses ?? null;
}

export async function persistStateCourses(abbr, courses) {
  const cache = await loadCache();
  cache[abbr] = { courses, fetchedAt: Date.now() };
  await persistCache(cache);
  return cache[abbr];
}
