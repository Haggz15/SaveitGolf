import { supabase } from './supabase';

const EXT_TO_CONTENT_TYPE = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
};

function guessContentType(uri, mediaType) {
  const ext = uri.split('.').pop()?.toLowerCase().split('?')[0];
  return EXT_TO_CONTENT_TYPE[ext] || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
}

// Uploads a local file uri (from expo-image-picker) into the public `posts`
// storage bucket under the owning user's folder, then returns its public URL.
async function uploadMedia(userId, uri, mediaType) {
  const ext = uri.split('.').pop()?.split('?')[0] || (mediaType === 'video' ? 'mp4' : 'jpg');
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
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

function mapRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    user: row.profiles?.username ?? 'golfer',
    fullName: row.profiles?.full_name ?? null,
    course: row.course_name,
    courseId: row.course_id,
    city: row.city,
    state: row.state,
    hole: row.hole,
    par: row.par,
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

// Real posts for the feed, newest first. `userIds`, when provided, scopes
// results to those authors (used by the Following filter).
export async function getFeedPosts({ userIds } = {}) {
  let request = supabase
    .from('posts')
    .select('*, profiles!posts_user_id_profiles_fkey(username, full_name)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (userIds) {
    if (userIds.length === 0) return [];
    request = request.in('user_id', userIds);
  }

  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getUserPosts(userId) {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', userId)
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

// Distinct courses a user has posted to — used by the Map's "Search Friends" pins.
export async function getCoursesPostedByUser(userId) {
  const { data, error } = await supabase
    .from('posts')
    .select('course_id, course_name, city, state, lat, lng')
    .eq('user_id', userId)
    .not('lat', 'is', null);

  if (error) throw error;
  return data ?? [];
}
