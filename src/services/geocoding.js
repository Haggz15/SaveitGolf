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
    const res = await fetch(url, { headers: { 'Accept-Language': 'en-US' } });
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

// Geocodes a course address via OpenStreetMap's Nominatim API, caching
// results in AsyncStorage keyed by courseId so repeat app launches don't
// re-spend the shared 1 req/sec budget.
export async function geocodeCourse(courseId, address) {
  const cache = await loadCache();
  if (cache[courseId]) {
    return cache[courseId];
  }

  const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
  const res = await throttledFetch(url);
  if (!res.ok) {
    throw new Error(`Geocoding request failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!data.length) {
    throw new Error(`Geocoding failed for "${address}": no results`);
  }

  const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  cache[courseId] = result;
  await persistCache(cache);
  return result;
}

export async function getCachedGeocode(courseId) {
  const cache = await loadCache();
  return cache[courseId] ?? null;
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
