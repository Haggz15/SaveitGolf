import { supabase } from './supabase';
import { resolveMentionedUserIds } from './mentions';
import { createNotification } from './notifications';

const EXT_TO_CONTENT_TYPE = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
};

// Pulls the extension off just the final path segment of a uri — not the
// whole string — so a web `blob:https://host.com/<uuid>` uri (no real
// extension of its own) doesn't have ".com" mistaken for one via the dot in
// the host name.
function getFileExtension(uri) {
  const path = uri.split('?')[0].split('#')[0];
  const lastSegment = path.split('/').pop() || '';
  const dotIndex = lastSegment.lastIndexOf('.');
  return dotIndex > 0 ? lastSegment.slice(dotIndex + 1).toLowerCase() : null;
}

function guessContentType(uri, mediaType) {
  const ext = getFileExtension(uri);
  return (ext && EXT_TO_CONTENT_TYPE[ext]) || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
}

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 120000;
const MAX_UPLOAD_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

function uploadWithTimeout(path, body, contentType) {
  const uploadPromise = supabase.storage.from('posts').upload(path, body, { contentType, upsert: false });
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Upload timed out. Please check your connection and try again.')), UPLOAD_TIMEOUT_MS)
  );
  return Promise.race([uploadPromise, timeoutPromise]);
}

// Uploads a local file uri (from expo-image-picker) into the public `posts`
// storage bucket under the owning user's folder, then returns its public URL.
// Large/video files occasionally fail on flaky connections, so the actual
// storage upload (not the initial fetch-to-bytes step) is retried a couple
// times with a short backoff; `onRetry(attempt)` — if given — lets the
// caller surface a "retrying" status while that happens.
async function uploadMedia(userId, uri, mediaType, onRetry) {
  const ext = getFileExtension(uri) || (mediaType === 'video' ? 'mp4' : 'jpg');
  const path = `${userId}/${Date.now()}.${ext}`;
  const contentType = guessContentType(uri, mediaType);

  const response = await fetch(uri);
  if (!response.ok) throw new Error('Failed to read the selected file.');
  const arrayBuffer = await response.arrayBuffer();

  if (arrayBuffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('File is too large. Please use a shorter video.');
  }

  let lastError;
  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt++) {
    try {
      const { error: uploadError } = await uploadWithTimeout(path, arrayBuffer, contentType);
      if (uploadError) throw new Error(uploadError.message);

      const { data } = supabase.storage.from('posts').getPublicUrl(path);
      return data.publicUrl;
    } catch (err) {
      lastError = err;
      console.error(`Media upload attempt ${attempt} failed:`, err.message);
      if (attempt < MAX_UPLOAD_ATTEMPTS) {
        onRetry?.(attempt);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }
    }
  }
  throw lastError;
}

export async function createPost({
  userId,
  course,
  hole,
  par,
  caption,
  mediaUri,
  mediaType,
  compositeName,
  onUploadRetry,
}) {
  const mediaUrl = await uploadMedia(userId, mediaUri, mediaType, onUploadRetry);

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      course_id: course?.id ?? null,
      course_name: course?.name ?? 'Unknown course',
      city: course?.city ?? null,
      state: course?.state ?? null,
      lat: course?.lat ?? null,
      lng: course?.lng ?? null,
      hole: hole ?? null,
      par: par ?? null,
      caption: caption || null,
      media_url: mediaUrl,
      media_type: mediaType,
      composite_name: compositeName || null,
    })
    .select()
    .single();

  if (error) throw error;

  // Tagging is a side effect of the caption, not the post itself — a
  // failure here shouldn't undo an already-published post, so it's caught
  // and logged rather than rethrown.
  if (caption) {
    try {
      const mentionedUserIds = await resolveMentionedUserIds(caption);
      const taggedUserIds = [...new Set(mentionedUserIds)].filter((id) => id !== userId);

      if (taggedUserIds.length > 0) {
        const { error: tagError } = await supabase
          .from('post_tags')
          .insert(taggedUserIds.map((taggedUserId) => ({ post_id: data.id, tagged_user_id: taggedUserId, tagged_by: userId })));
        if (tagError) throw tagError;

        await Promise.all(
          taggedUserIds.map((taggedUserId) =>
            createNotification({ userId: taggedUserId, actorId: userId, type: 'tag', postId: data.id })
          )
        );
      }
    } catch (err) {
      console.error('Failed to tag mentioned users in post caption:', err);
    }
  }

  return data;
}

export function mapRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    user: row.profiles?.username ?? 'golfer',
    fullName: row.profiles?.full_name ?? null,
    avatarUrl: row.profiles?.avatar_url ?? null,
    course: row.course_name,
    courseId: row.course_id,
    city: row.city,
    state: row.state,
    lat: row.lat,
    lng: row.lng,
    hole: row.hole,
    par: row.par,
    compositeName: row.composite_name ?? null,
    caption: row.caption ?? '',
    likes: row.likes_count ?? 0,
    comments: row.comments_count ?? 0,
    timeAgo: timeAgo(row.created_at),
    isVideo: row.media_type === 'video',
    mediaUrl: row.media_url,
    createdAt: row.created_at,
  };
}

function timeAgo(isoDate) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// Real posts for the Following feed, newest first. `userIds` scopes results
// to the authors the current user follows — an empty list short-circuits to
// no query at all. `excludeUserIds` drops posts from anyone the current user
// has blocked (see services/moderation.js) — filtered client-side since it's
// just a handful of ids at most. `offset`/`limit` paginate the query
// directly. Posts auto-hidden by the report threshold (posts.hidden) never
// come back from this query at all.
export async function getFeedPosts({ userIds, excludeUserIds, offset = 0, limit = 20 } = {}) {
  if (userIds && userIds.length === 0) return [];

  let request = supabase
    .from('posts')
    .select('*, profiles!posts_user_id_profiles_fkey(username, full_name, avatar_url)')
    .eq('hidden', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (userIds) {
    request = request.in('user_id', userIds);
  }

  const { data, error } = await request;
  if (error) throw error;
  let posts = (data ?? []).map(mapRow);

  if (excludeUserIds && excludeUserIds.size > 0) {
    posts = posts.filter((post) => !excludeUserIds.has(post.userId));
  }

  return posts;
}

export async function getUserPosts(userId) {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', userId)
    .eq('hidden', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getPostsCount(userId) {
  const { count, error } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) throw error;
  return count ?? 0;
}

// Bumps posts.shares_count via a security-definer RPC (instead of a
// read-modify-write from the client) — feeds into the Shot of the Week
// engagement score alongside likes_count and comments_count.
export async function incrementShareCount(postId) {
  const { error } = await supabase.rpc('increment_share_count', { post_id: postId });
  if (error) throw error;
}

// Posts for the same physical course can carry either a real
// golfcourseapi.com id (logged after picking a search result) or none at all
// (logged by typing the course name directly — the only option while course
// search is down, see golfCourseApi's ApiKeyError) — real data has courses
// with posts of both kinds. Matching by course_id alone whenever one happens
// to be known silently drops the free-typed posts (and vice versa for a
// name-only match missing the id-tagged ones), which is why a course's hole
// grid can undercount, or a specific hole's tap can come back empty, even
// though posts for it exist. Queries by id and by name (whichever are
// known) and merges the results, deduped by post id, so every caller sees
// the full set regardless of which identity it was handed.
async function fetchCourseRows(select, { courseId, courseName }, refine = (q) => q) {
  const queries = [];
  if (courseId) {
    queries.push(refine(supabase.from('posts').select(select).eq('hidden', false).eq('course_id', courseId)));
  }
  if (courseName) {
    queries.push(refine(supabase.from('posts').select(select).eq('hidden', false).ilike('course_name', courseName)));
  }
  if (queries.length === 0) return [];

  const results = await Promise.all(queries);
  for (const { error } of results) {
    if (error) throw error;
  }
  const merged = new Map();
  for (const { data } of results) {
    for (const row of data ?? []) merged.set(row.id, row);
  }
  return [...merged.values()];
}

// All posts at a given course, sorted most-liked first — used by the Course
// Detail screen's All Posts tab.
export async function getPostsForCourse({ courseId, courseName }) {
  const rows = await fetchCourseRows(
    '*, profiles!posts_user_id_profiles_fkey(username, full_name, avatar_url)',
    { courseId, courseName }
  );
  return rows.map(mapRow).sort((a, b) => b.likes - a.likes);
}

// Lightweight per-post `{ hole, compositeName }` pairs for the Course Detail
// screen's stats bar and Hole by Hole grid — those only ever count/group by
// hole and nine, never render the posts themselves (that's CourseFeed's
// job), so this skips the profile join and full row (media, caption, likes)
// that getPostsForCourse fetches.
export async function getCourseHoleStats({ courseId, courseName }) {
  const rows = await fetchCourseRows('id, hole, composite_name', { courseId, courseName });
  return rows.map((row) => ({ hole: row.hole, compositeName: row.composite_name ?? null }));
}

// Backfills lat/lng on a post once its course has been geocoded on demand
// (see FeedScreen.handleCoursePress / useCourseMapData's routeZoomToState
// handling) so the next tap on the same post's course name skips the
// geocoding round-trip entirely. Best-effort and silent on failure — a
// write hiccup here shouldn't block the map from showing the course this
// time around, and demo/mock posts (non-UUID ids, no real row) are expected
// to fail this update harmlessly.
export async function updatePostCoordinates(postId, lat, lng) {
  const { error } = await supabase.from('posts').update({ lat, lng }).eq('id', postId);
  if (error) console.error('Failed to save geocoded coordinates back to post:', error);
}

// Sentinel for "posts at this course that never tagged a nine" — distinct
// from `compositeName: undefined/null`, which means "don't filter by nine at
// all" (used when the course has no composite-named posts in the first
// place). Shared between CourseDetailScreen (the "Other Holes" section) and
// getCourseFeedPosts below, which needs to tell the two cases apart.
export const UNGROUPED_NINE = '__ungrouped__';

// Paginated, sortable feed for the course/hole full-screen swipe views
// (CourseDetailScreen -> CourseFeed). `hole` and `compositeName` are both
// optional filters layered on top of the course match; `compositeName` is
// only applied when explicitly a real name or UNGROUPED_NINE — omitting it
// (the classic non-composite course) returns every post at that hole
// regardless of nine, same as getPostsForCourse's hole-agnostic behavior.
export async function getCourseFeedPosts({
  courseId,
  courseName,
  hole,
  compositeName,
  sort = 'likes',
  offset = 0,
  limit = 10,
}) {
  const rows = await fetchCourseRows(
    '*, profiles!posts_user_id_profiles_fkey(username, full_name, avatar_url)',
    { courseId, courseName },
    (q) => {
      if (hole != null) q = q.eq('hole', hole);
      if (compositeName === UNGROUPED_NINE) {
        q = q.is('composite_name', null);
      } else if (compositeName) {
        q = q.eq('composite_name', compositeName);
      }
      return q;
    }
  );

  // Sorted/paginated client-side now that rows can come from two merged
  // queries (see fetchCourseRows) — scoped down to one hole (and course) at
  // a time, so this stays a small, cheap set rather than the whole feed.
  const sorted = rows
    .map(mapRow)
    .sort((a, b) =>
      sort === 'recent' ? new Date(b.createdAt) - new Date(a.createdAt) : b.likes - a.likes
    );

  return sorted.slice(offset, offset + limit);
}
