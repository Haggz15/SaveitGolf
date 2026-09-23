// Supabase Edge Function: hands the app a short-lived presigned PUT URL for
// one object in a Cloudflare R2 bucket.
//
// Runs server-side (Deno) so the R2 secret access key never ships in the app
// bundle — an R2 key has full read/write/delete on its buckets with nothing
// like Supabase's RLS in front of it, so anyone who pulled it out of the JS
// bundle (trivially, on the public web build) could wipe every user's media.
// Instead this function checks the caller's Supabase session and only signs
// uploads under that user's own `{userId}/` folder.
//
// Called from the client via supabase.functions.invoke('r2-presign', ...)
// in src/services/r2Storage.js, which then PUTs the file bytes straight to R2.
//
// Deploy:
//   supabase functions deploy r2-presign
// Secrets (required):
//   supabase secrets set R2_ACCOUNT_ID=28ba4b656326e92419a52d363ace2524
//   supabase secrets set R2_ACCESS_KEY_ID=xxx
//   supabase secrets set R2_SECRET_ACCESS_KEY=xxx
//
// Web uploads also need a CORS policy on each R2 bucket (Cloudflare dashboard
// → R2 → bucket → Settings → CORS policy) allowing PUT with a Content-Type
// header from https://saveitgolf.com (and http://localhost:8081 for dev).

import { AwsClient } from 'npm:aws4fetch@1.0.20';
import { createClient } from 'npm:@supabase/supabase-js@2';

// App-facing bucket names (matching the old Supabase storage buckets) → the
// R2 bucket and its public r2.dev base URL.
const BUCKETS: Record<string, { r2Bucket: string; publicBaseUrl: string }> = {
  posts: {
    r2Bucket: 'saveitgolf-posts',
    publicBaseUrl: 'https://pub-292a83d83c614c4e838b6a90259dc020.r2.dev',
  },
  avatars: {
    r2Bucket: 'saveitgolf-avatars',
    publicBaseUrl: 'https://pub-9c3408f0ad8a4496912f685922400394.r2.dev',
  },
  scorecards: {
    r2Bucket: 'saveitgolf-scorecards',
    publicBaseUrl: 'https://pub-63731b780f7844598ab59eeb873a9bf2.r2.dev',
  },
};

const URL_EXPIRY_SECONDS = 600;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error('[r2-presign] R2 secrets are not set');
    return jsonResponse({ error: 'Storage is not configured' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Not signed in' }, 401);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return jsonResponse({ error: 'Not signed in' }, 401);
  const userId = userData.user.id;

  let body: { bucket?: string; path?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const bucket = body.bucket ? BUCKETS[body.bucket] : undefined;
  if (!bucket) return jsonResponse({ error: 'Unknown bucket' }, 400);

  // Only allow keys inside the caller's own folder, made of plain path
  // characters, so one user can never overwrite another's avatar/media.
  const path = body.path ?? '';
  if (!path.startsWith(`${userId}/`) || path.includes('..') || !/^[A-Za-z0-9._\-/]+$/.test(path)) {
    return jsonResponse({ error: 'Invalid upload path' }, 403);
  }

  const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  const objectUrl = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket.r2Bucket}/${path}`);
  objectUrl.searchParams.set('X-Amz-Expires', String(URL_EXPIRY_SECONDS));
  const signed = await r2.sign(new Request(objectUrl, { method: 'PUT' }), { aws: { signQuery: true } });

  return jsonResponse({
    uploadUrl: signed.url,
    publicUrl: `${bucket.publicBaseUrl}/${path}`,
  });
});
