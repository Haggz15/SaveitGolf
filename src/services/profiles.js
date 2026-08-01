import { supabase } from './supabase';

const EXT_TO_CONTENT_TYPE = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
};

// Uploads a local file uri (from expo-image-picker) into the public
// `avatars` storage bucket at a fixed per-user path, overwriting any
// previous photo, then returns its public URL.
export async function uploadAvatar(userId, uri) {
  const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
  const path = `${userId}/avatar.${ext}`;
  const contentType = EXT_TO_CONTENT_TYPE[ext] || 'image/jpeg';

  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, arrayBuffer, { contentType, upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // Cache-bust so re-uploading a photo at the same path shows immediately
  // instead of the previous image cached under the same URL.
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Used from Profile Setup (Continue and Skip both call this — Skip just
// omits the optional fields) and creates the user's profiles row.
export async function insertProfile(userId, { username, fullName, homeState, handicapIndex, avatarUrl } = {}) {
  const payload = { user_id: userId };

  if (username !== undefined) payload.username = username;
  if (fullName !== undefined) payload.full_name = fullName;
  if (homeState !== undefined) payload.home_state = homeState;
  if (handicapIndex !== undefined) payload.handicap_index = handicapIndex;
  if (avatarUrl !== undefined) payload.avatar_url = avatarUrl;

  const { data, error } = await supabase
    .from('profiles')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfile(userId, { username, fullName, homeState, handicapIndex, avatarUrl } = {}) {
  const payload = {};

  if (username !== undefined) payload.username = username;
  if (fullName !== undefined) payload.full_name = fullName;
  if (homeState !== undefined) payload.home_state = homeState;
  if (handicapIndex !== undefined) payload.handicap_index = handicapIndex;
  if (avatarUrl !== undefined) payload.avatar_url = avatarUrl;

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
