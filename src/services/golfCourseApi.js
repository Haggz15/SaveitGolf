import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_KEY = Constants.expoConfig?.extra?.golfCourseApiKey;
const BASE_URL = 'https://api.golfcourseapi.com/v1';

// Free tier is capped at 50 requests/day, shared across every install of this
// app using the same key. The API exposes no remaining-quota header, so this
// is a best-effort local counter — a real HTTP 429 is still the authority.
export const DAILY_REQUEST_LIMIT = 50;
// Leave headroom for user-initiated lookups (course detail taps) even if
// background area-discovery has been busy.
const BACKGROUND_SAFETY_MARGIN = 5;
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
    throw new Error('Missing GOLF_COURSE_API_KEY — add it to .env');
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Key ${API_KEY}` },
  });
  await recordRequest();
  if (res.status === 429) {
    throw new RateLimitError('golfcourseapi.com daily request limit reached');
  }
  if (!res.ok) {
    throw new Error(`golfcourseapi.com request failed: HTTP ${res.status}`);
  }
  return res.json();
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

// The API has no public/private field and no coordinates — those are
// deliberately absent here rather than guessed. See geocoding.js for lat/lng.
function normalizeCourse(course) {
  return {
    id: String(course.id),
    name: course.club_name || course.course_name,
    address: course.location?.address ?? null,
    city: course.location?.city ?? null,
    state: course.location?.state ?? null,
    country: course.location?.country ?? null,
    tees: course.tees ?? null,
  };
}
