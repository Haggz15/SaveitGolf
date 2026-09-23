import { supabase } from './supabase';

// Uploads raw file bytes to Cloudflare R2 and returns the object's public URL.
// The R2 secret key never ships in the app: the `r2-presign` Edge Function
// (supabase/functions/r2-presign) checks the caller's session, only signs
// paths under their own `{userId}/` folder, and returns a short-lived
// presigned PUT URL that the bytes are sent to directly.
// `bucket` is the app-facing name: 'posts', 'avatars' or 'scorecards'.
export async function uploadToR2(bucket, path, body, contentType) {
  const { data, error } = await supabase.functions.invoke('r2-presign', {
    body: { bucket, path },
  });
  if (error) throw new Error(error.message || 'Could not prepare upload.');

  const response = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  });
  if (!response.ok) throw new Error(`Upload failed (${response.status}).`);

  return data.publicUrl;
}
