import { supabase } from './supabase';
import { uploadToR2 } from './r2Storage';
import { compressImage } from '../utils/imageCompression';

// Avatars only ever show as small circles, so 512px is plenty even on a
// 3x screen — a full-size crop was uploading at 1-2 MB.
const AVATAR_MAX_DIMENSION = 512;

// Uploads a local file uri (from expo-image-picker) into the public
// `avatars` R2 bucket at a fixed per-user path, overwriting any
// previous photo, then returns its public URL. Always re-encoded as JPEG,
// so the path no longer depends on the picked file's extension.
export async function uploadAvatar(userId, uri) {
  const path = `${userId}/avatar.jpg`;
  const compressedUri = await compressImage(uri, { maxDimension: AVATAR_MAX_DIMENSION, quality: 0.8 });

  const response = await fetch(compressedUri);
  const arrayBuffer = await response.arrayBuffer();

  const publicUrl = await uploadToR2('avatars', path, arrayBuffer, 'image/jpeg');
  // Cache-bust so re-uploading a photo at the same path shows immediately
  // instead of the previous image cached under the same URL.
  return `${publicUrl}?t=${Date.now()}`;
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
