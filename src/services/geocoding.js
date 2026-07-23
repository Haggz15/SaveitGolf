import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey;
const CACHE_KEY = 'saveitgolf.geocodeCache.v1';

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

// Geocodes a course address via Google's Geocoding API, caching results in
// AsyncStorage keyed by courseId so repeat app launches don't re-spend quota.
export async function geocodeCourse(courseId, address) {
  if (!API_KEY) {
    throw new Error('Missing GOOGLE_MAPS_API_KEY — add it to .env');
  }
  const cache = await loadCache();
  if (cache[courseId]) {
    return cache[courseId];
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Geocoding request failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(`Geocoding failed for "${address}": ${data.status}`);
  }

  const { lat, lng } = data.results[0].geometry.location;
  const result = { lat, lng };
  cache[courseId] = result;
  await persistCache(cache);
  return result;
}

export async function getCachedGeocode(courseId) {
  const cache = await loadCache();
  return cache[courseId] ?? null;
}

const REVERSE_CACHE_KEY = 'saveitgolf.reverseGeocodeCache.v1';
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

// Converts GPS coordinates into a { city, state } pair via Google's reverse
// geocoding, since golfcourseapi.com only supports text search — this lets us
// turn "find courses near me" into "search this city's name".
export async function reverseGeocode(lat, lng) {
  if (!API_KEY) {
    throw new Error('Missing GOOGLE_MAPS_API_KEY — add it to .env');
  }
  const key = reverseCacheKey(lat, lng);
  const cache = await loadReverseCache();
  if (cache[key]) {
    return cache[key];
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Reverse geocoding request failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(`Reverse geocoding failed for ${lat},${lng}: ${data.status}`);
  }

  let city = null;
  let state = null;
  for (const component of data.results[0].address_components) {
    if (component.types.includes('locality')) city = component.long_name;
    if (component.types.includes('administrative_area_level_1')) state = component.short_name;
  }
  if (!city) {
    // Fall back to the next-broadest component (e.g. a county) if there's no city proper.
    const fallback = data.results[0].address_components.find((c) =>
      c.types.includes('administrative_area_level_2')
    );
    city = fallback?.long_name ?? null;
  }

  const result = { city, state };
  cache[key] = result;
  await persistReverseCache(cache);
  return result;
}
