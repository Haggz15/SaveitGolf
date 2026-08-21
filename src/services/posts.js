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

// Uploads a local file uri (from expo-image-picker) into the public `posts`
// storage bucket under the owning user's folder, then returns its public URL.
async function uploadMedia(userId, uri, mediaType) {
  const ext = getFileExtension(uri) || (mediaType === 'video' ? 'mp4' : 'jpg');
  const path = `${userId}/${Date.now()}.${ext}`;
  const contentType = guessContentType(uri, mediaType);

  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('posts')
    .upload(path, arrayBuffer, { contentType, upsert: false });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('posts').getPublicUrl(path);
  return data.publicUrl;
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
}) {
  const mediaUrl = await uploadMedia(userId, mediaUri, mediaType);

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

// All posts at a given course, sorted most-liked first — used by the Course
// Detail screen's All Posts tab. Matches by course_id when the post was
// logged against a golfcourseapi.com course; falls back to a case-insensitive
// name match for posts logged with a free-typed course name (course_id null).
export async function getPostsForCourse({ courseId, courseName }) {
  let request = supabase
    .from('posts')
    .select('*, profiles!posts_user_id_profiles_fkey(username, full_name, avatar_url)')
    .eq('hidden', false);

  request = courseId ? request.eq('course_id', courseId) : request.ilike('course_name', courseName ?? '');

  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []).map(mapRow).sort((a, b) => b.likes - a.likes);
}

// Lightweight per-post `{ hole, compositeName }` pairs for the Course Detail
// screen's stats bar and Hole by Hole grid — those only ever count/group by
// hole and nine, never render the posts themselves (that's CourseFeed's
// job), so this skips the profile join and full row (media, caption, likes)
// that getPostsForCourse fetches. Same course_id-with-name-fallback match.
export async function getCourseHoleStats({ courseId, courseName }) {
  let request = supabase.from('posts').select('hole, composite_name').eq('hidden', false);
  request = courseId ? request.eq('course_id', courseId) : request.ilike('course_name', courseName ?? '');

  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []).map((row) => ({ hole: row.hole, compositeName: row.composite_name ?? null }));
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
  let request = supabase
    .from('posts')
    .select('*, profiles!posts_user_id_profiles_fkey(username, full_name, avatar_url)')
    .eq('hidden', false);

  request = courseId ? request.eq('course_id', courseId) : request.ilike('course_name', courseName ?? '');

  if (hole != null) {
    request = request.eq('hole', hole);
  }
  if (compositeName === UNGROUPED_NINE) {
    request = request.is('composite_name', null);
  } else if (compositeName) {
    request = request.eq('composite_name', compositeName);
  }

  request =
    sort === 'recent'
      ? request.order('created_at', { ascending: false })
      : request.order('likes_count', { ascending: false });
  request = request.range(offset, offset + limit - 1);

  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []).map(mapRow);
}
