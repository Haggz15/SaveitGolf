import AsyncStorage from '@react-native-async-storage/async-storage';
import stateCenters from '../data/stateCenters.json';

const CACHE_KEY = 'saveitgolf.geocodeCache.v1';
const REVERSE_CACHE_KEY = 'saveitgolf.reverseGeocodeCache.v1';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

// OpenStreetMap's Nominatim is free and needs no API key, but its usage
// policy caps unauthenticated use to ~1 request/second. geocodeCourse and
// reverseGeocode share this single queue so bursts (e.g. several newly
// discovered courses) get spaced out instead of hammering the API at once.
const MIN_REQUEST_INTERVAL_MS = 1100;
let requestChain = Promise.resolve();

function throttledFetch(url) {
  const run = requestChain.then(async () => {
    // Nominatim's usage policy requires a real User-Agent identifying the app.
    const res = await fetch(url, { headers: { 'Accept-Language': 'en-US', 'User-Agent': 'SaveitGolf/1.0' } });
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS));
    return res;
  });
  requestChain = run.catch(() => {});
  return run;
}

// Nominatim's reverse geocode returns full state names ("Kansas"), but
// golfcourseapi.com and the rest of the app deal in abbreviations ("KS").
const stateNameToAbbr = Object.fromEntries(
  Object.entries(stateCenters).map(([abbr, { name }]) => [name.toLowerCase(), abbr])
);

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

async function nominatimSearch(query) {
  const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`;
  const res = await throttledFetch(url);
  if (!res.ok) {
    throw new Error(`Geocoding request failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

// Builds a fallback chain of queries to try, most-specific first. The full
// street address is often unmatchable by Nominatim's free-text search —
// suite numbers ("#500"), highway-grid street numbers ("25W253"), or a
// slightly-off city component (the API's city field doesn't always match
// what OSM has) all cause a clean address to return zero results. Dropping
// down to "name, city, state", then just "name", then just "city, state"
// recovers real matches for those cases; each is progressively less precise
// but still lands the pin in the right place.
function geocodeQueryChain(address, { name, city, state } = {}) {
  const queries = [address];
  if (name && city && state) queries.push(`${name}, ${city}, ${state}`);
  if (name) queries.push(name);
  if (city && state) queries.push(`${city}, ${state}`);
  return [...new Set(queries.filter(Boolean))];
}

// Geocodes a course via OpenStreetMap's Nominatim API, caching results in
// AsyncStorage keyed by courseId so repeat app launches don't re-spend the
// shared 1 req/sec budget. Falls back through progressively less specific
// queries (see geocodeQueryChain) when the exact address has no match.
export async function geocodeCourse(courseId, address, { name, city, state } = {}) {
  const cache = await loadCache();
  if (cache[courseId]) {
    return cache[courseId];
  }

  const attempts = geocodeQueryChain(address, { name, city, state });
  for (const query of attempts) {
    const result = await nominatimSearch(query);
    if (result) {
      if (query !== address) {
        console.warn(`[geocoding] "${address}" had no match — used fallback query "${query}" instead`);
      }
      cache[courseId] = result;
      await persistCache(cache);
      return result;
    }
  }

  throw new Error(
    `Geocoding failed for "${address}": no results after ${attempts.length} attempt(s) (${attempts.join(' | ')})`
  );
}

export async function getCachedGeocode(courseId) {
  const cache = await loadCache();
  return cache[courseId] ?? null;
}

// golfcourseapi.com's search endpoint doesn't return usable coordinates, so
// the map geocodes a normalized course (id/name/address/city/state, as
// produced by golfCourseApi.normalizeCourse) via Nominatim before placing
// its pin. Returns null (rather than throwing) when no match is found, since
// callers show the course either way and just skip the map pin.
export async function geocodeCourseCoordinates(course) {
  const address = course?.address || [course?.city, course?.state].filter(Boolean).join(', ');
  if (!address || !course?.id) return null;
  try {
    return await geocodeCourse(course.id, address, { name: course.name, city: course.city, state: course.state });
  } catch (err) {
    console.warn(`[geocoding] could not geocode course "${course?.name}":`, err.message);
    return null;
  }
}

let reverseCachePromise = null;

async function loadReverseCache() {
  if (!reverseCachePromise) {
    reverseCachePromise = AsyncStorage.getItem(REVERSE_CACHE_KEY).then((raw) =>
      raw ? JSON.parse(raw) : {}
    );
  }
  return reverseCachePromise;
}

async function persistReverseCache(cache) {
  await AsyncStorage.setItem(REVERSE_CACHE_KEY, JSON.stringify(cache));
}

// Rounds to ~1.1km so nearby lookups (e.g. small map pans) share a cache entry.
function reverseCacheKey(lat, lng) {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

// Converts GPS coordinates into a { city, state } pair via Nominatim reverse
// geocoding, since golfcourseapi.com only supports text search — this lets us
// turn "find courses near this point" into "search this city's name".
export async function reverseGeocode(lat, lng) {
  const key = reverseCacheKey(lat, lng);
  const cache = await loadReverseCache();
  if (cache[key]) {
    return cache[key];
  }

  const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`;
  const res = await throttledFetch(url);
  if (!res.ok) {
    throw new Error(`Reverse geocoding request failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  const addr = data.address ?? {};
  const city = addr.city || addr.town || addr.village || addr.hamlet || addr.county || null;
  const stateName = addr.state ?? null;
  const state = stateName ? stateNameToAbbr[stateName.toLowerCase()] ?? stateName : null;

  const result = { city, state };
  cache[key] = result;
  await persistReverseCache(cache);
  return result;
}
