// Supabase Edge Function: emails the admin whenever a post is reported.
//
// Runs server-side (Deno) specifically so the Resend API key never ships in
// the app bundle — unlike GOLF_COURSE_API_KEY (a rate-limited, client-safe
// key fetched directly from the RN app), a transactional-email key must stay
// secret, so this function is the one thing in the moderation flow that
// can't just be a client-side `fetch` like the rest of this codebase's
// third-party API calls (see src/services/geocoding.js, golfCourseApi.js).
//
// Called from the client via supabase.functions.invoke('report-notification', ...)
// after a row is inserted into public.reports (see src/services/moderation.js).
//
// Deploy:
//   supabase functions deploy report-notification
// Secrets (required):
//   supabase secrets set RESEND_API_KEY=re_xxx
// Secrets (optional, have defaults below):
//   supabase secrets set ADMIN_EMAIL=owenphaggerty@gmail.com
//   supabase secrets set RESEND_FROM_EMAIL="SaveitGolf <onboarding@resend.dev>"
//   supabase secrets set APP_WEB_URL=https://saveitgolf.com
//
// Get a free Resend API key at https://resend.com — the sandbox sender
// address `onboarding@resend.dev` works out of the box without verifying a
// domain, but can only deliver to the email address on the Resend account
// itself. Verify a domain (or use a different provider) once you need to
// notify an address other than the one the Resend account was created with.

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let payload: {
    postId?: string;
    reporterUsername?: string;
    reason?: string;
    mediaUrl?: string;
    autoHidden?: boolean;
  };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { postId, reporterUsername, reason, mediaUrl, autoHidden } = payload;
  if (!postId || !reason) {
    return jsonResponse({ error: 'postId and reason are required' }, 400);
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) {
    console.error('[report-notification] Missing RESEND_API_KEY secret');
    return jsonResponse({ error: 'Email is not configured on the server' }, 500);
  }
  const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'owenphaggerty@gmail.com';
  const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'SaveitGolf <onboarding@resend.dev>';
  // No permalink screen exists in the app yet (the feed has no single-post
  // route), so the most useful "direct link to the reported post" today is
  // the post's own public media URL — it opens the exact reported
  // photo/video. APP_WEB_URL, if set, adds a deep link too for whenever a
  // post-detail route exists to receive it.
  const APP_WEB_URL = Deno.env.get('APP_WEB_URL');

  const subject = autoHidden
    ? `⚠️ SaveitGolf: post auto-hidden after 5 reports`
    : `SaveitGolf: new post report`;

  const htmlParts = [
    autoHidden
      ? `<p style="color:#c0001a;font-weight:700;">This report just pushed the post to 5 total reports — it has been automatically hidden from the feed.</p>`
      : '',
    `<p><strong>Post ID:</strong> ${escapeHtml(postId)}</p>`,
    `<p><strong>Reported by:</strong> @${escapeHtml(reporterUsername || 'unknown')}</p>`,
    `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>`,
    mediaUrl ? `<p><strong>Reported post:</strong> <a href="${mediaUrl}">${mediaUrl}</a></p>` : '',
    APP_WEB_URL ? `<p><a href="${APP_WEB_URL}/post/${postId}">${APP_WEB_URL}/post/${postId}</a></p>` : '',
    `<p style="color:#666;font-size:12px;">Review, dismiss, or remove this report from the "reports" table in the Supabase dashboard.</p>`,
  ].filter(Boolean);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject,
        html: htmlParts.join('\n'),
      }),
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      console.error('[report-notification] Resend request failed:', res.status, body);
      return jsonResponse({ error: 'Failed to send email', detail: body }, 502);
    }

    console.log('[report-notification] sent', { postId, autoHidden, resendId: body?.id });
    return jsonResponse({ ok: true, id: body?.id });
  } catch (err) {
    console.error('[report-notification] unexpected error sending email:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
