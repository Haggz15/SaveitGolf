import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_KEY = Constants.expoConfig?.extra?.golfCourseApiKey;
const BASE_URL = 'https://api.golfcourseapi.com/v1';

console.log(
  API_KEY
    ? `[golfcourseapi] GOLF_COURSE_API_KEY found (${API_KEY.length} chars)`
    : '[golfcourseapi] GOLF_COURSE_API_KEY is undefined — check .env and app.config.js'
);

// This key's plan is capped at 10,000 requests/day, shared across every
// install of this app using the same key. The API exposes no remaining-quota
// header, so this is a best-effort local counter — a real HTTP 429 is still
// the authority.
export const DAILY_REQUEST_LIMIT = 10000;
// Leave headroom for user-initiated lookups (course detail taps) even if
// background area-discovery has been busy.
const BACKGROUND_SAFETY_MARGIN = 200;
const QUOTA_KEY = 'saveitgolf.golfApiQuota.v1';

export class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitError';
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function readQuota() {
  const raw = await AsyncStorage.getItem(QUOTA_KEY);
  const parsed = raw ? JSON.parse(raw) : null;
  if (!parsed || parsed.date !== todayKey()) {
    return { date: todayKey(), count: 0 };
  }
  return parsed;
}

async function recordRequest() {
  const quota = await readQuota();
  quota.count += 1;
  await AsyncStorage.setItem(QUOTA_KEY, JSON.stringify(quota));
  return quota;
}

export async function getQuotaStatus() {
  const quota = await readQuota();
  return {
    used: quota.count,
    remaining: Math.max(0, DAILY_REQUEST_LIMIT - quota.count),
    limit: DAILY_REQUEST_LIMIT,
  };
}

// For discretionary background calls (area discovery on pan/zoom) — user-
// initiated lookups (search, course detail) should proceed regardless and
// let a real 429 be the backstop.
export async function hasBackgroundQuota() {
  const quota = await readQuota();
  return quota.count < DAILY_REQUEST_LIMIT - BACKGROUND_SAFETY_MARGIN;
}

async function apiFetch(path) {
  if (!API_KEY) {
    const err = new Error('Missing GOLF_COURSE_API_KEY — add it to .env');
    console.error('[golfcourseapi]', err.message);
    throw err;
  }
  const url = `${BASE_URL}${path}`;
  console.log('[golfcourseapi] GET', url);
  const res = await fetch(url, {
    headers: { Authorization: `Key ${API_KEY}` },
  });
  await recordRequest();

  const body = await res.json().catch(() => null);
  console.log('[golfcourseapi] response', res.status, JSON.stringify(body));

  if (res.status === 429) {
    console.error('[golfcourseapi] rate limited:', body);
    throw new RateLimitError('golfcourseapi.com daily request limit reached');
  }
  if (!res.ok) {
    console.error('[golfcourseapi] request failed:', res.status, body);
    throw new Error(`golfcourseapi.com request failed: HTTP ${res.status}`);
  }
  return body;
}

export async function searchCourses(query) {
  const data = await apiFetch(`/search?search_query=${encodeURIComponent(query)}`);
  return (data.courses ?? []).map(normalizeCourse);
}

// Course detail lookups are cached in memory for the life of the app — the
// map popup and the Course Detail screen both want the same data, and this
// keeps a marker tap + "View holes & shots" from costing two requests.
const courseDetailCache = new Map();

export async function getCourseById(id) {
  const key = String(id);
  if (courseDetailCache.has(key)) {
    return courseDetailCache.get(key);
  }
  const data = await apiFetch(`/courses/${key}`);
  const course = normalizeCourse(data.course);
  courseDetailCache.set(key, course);
  return course;
}

// The API has no public/private field, so that's deliberately absent here
// rather than guessed (see CoursePopupCard's name-based estimate instead).
// It does return location.latitude/longitude directly, so those are used
// as-is — no need to re-geocode API-sourced courses via geocoding.js.
function normalizeCourse(course) {
  return {
    id: String(course.id),
    name: course.club_name || course.course_name,
    address: course.location?.address ?? null,
    city: course.location?.city ?? null,
    state: course.location?.state ?? null,
    country: course.location?.country ?? null,
    lat: course.location?.latitude ?? null,
    lng: course.location?.longitude ?? null,
    tees: course.tees ?? null,
  };
}
