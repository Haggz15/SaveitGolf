import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasValidCoordinates } from '../utils/mapCoords';

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
  return (data?.courses ?? []).map(normalizeCourse);
}

// Submits a course golfcourseapi.com doesn't know about yet (added manually
// from My Courses because search came up empty) so it becomes findable for
// everyone, not just the user who added it. Mirrors the club_name/location
// shape normalizeCourse reads back — the API's write schema isn't documented
// anywhere in this repo, so this is the best-known match for its read shape.
// Callers treat this as fire-and-forget: the local my_courses save is what
// the user's pin/UI depends on, so a failure here is only ever logged.
export async function submitNewCourse({ name, city, state, lat, lng }) {
  if (!API_KEY) {
    throw new Error('Missing GOLF_COURSE_API_KEY — add it to .env');
  }
  const url = `${BASE_URL}/courses`;
  const body = {
    club_name: name,
    location: {
      city: city ?? null,
      state: state ?? null,
      latitude: lat ?? null,
      longitude: lng ?? null,
    },
  };
  console.log('[golfcourseapi] POST', url, JSON.stringify(body));
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Key ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const responseBody = await res.json().catch(() => null);
  console.log('[golfcourseapi] submit response', res.status, JSON.stringify(responseBody));

  if (!res.ok) {
    throw new Error(`golfcourseapi.com course submission failed: HTTP ${res.status}`);
  }
  return responseBody;
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
  if (!data?.course) {
    throw new Error(`golfcourseapi.com returned no course for id ${key}`);
  }
  const course = normalizeCourse(data.course);
  courseDetailCache.set(key, course);
  return course;
}

// True for exactly one course object, the first one this session sees, so
// engineers can check devtools for the exact field names golfcourseapi.com
// is sending without wading through a full response dump on every request.
let loggedSampleCourse = false;

// The API has no public/private field, so that's deliberately absent here
// rather than guessed (see CoursePopupCard's name-based estimate instead).
// Coordinates are documented as location.latitude/location.longitude, but
// golfcourseapi.com (a) frequently omits them for a course entirely and (b)
// isn't contractually guaranteed to always nest them under `location` —
// course.latitude/course.longitude and course.lat/course.lng are checked as
// fallbacks in case the shape varies by endpoint or account tier.
function normalizeCourse(course) {
  if (!loggedSampleCourse && course) {
    loggedSampleCourse = true;
    console.log('[golfcourseapi] sample raw course object (field names):', JSON.stringify(course));
  }

  const rawLat = course?.location?.latitude ?? course?.latitude ?? course?.lat ?? null;
  const rawLng = course?.location?.longitude ?? course?.longitude ?? course?.lng ?? null;
  const validCoords = hasValidCoordinates(rawLat, rawLng);
  if (rawLat != null && rawLng != null && !validCoords) {
    console.warn(
      `[golfcourseapi] course "${course?.club_name || course?.course_name || course?.id}" has out-of-range or non-numeric coordinates:`,
      rawLat,
      rawLng
    );
  }

  return {
    id: String(course?.id),
    name: course?.club_name || course?.course_name,
    address: course?.location?.address ?? null,
    city: course?.location?.city ?? null,
    state: course?.location?.state ?? null,
    country: course?.location?.country ?? null,
    lat: validCoords ? Number(rawLat) : null,
    lng: validCoords ? Number(rawLng) : null,
    tees: course?.tees ?? null,
  };
}
