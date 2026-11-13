// Native password-reset deep link. The emailed recovery link goes through
// Supabase's /verify endpoint, which redirects to
//   com.saveitgolf.app://reset-password#access_token=…&refresh_token=…&type=recovery
// on success, or
//   com.saveitgolf.app://reset-password#error=access_denied&error_code=otp_expired&error_description=…
// when the link is expired/already used. (Params can also arrive in the
// query string, and a PKCE-flow link carries ?code= instead of tokens.)
// The web build doesn't use this — supabase.js's detectSessionInUrl handles it.

export const PASSWORD_RESET_DEEP_LINK = 'com.saveitgolf.app://reset-password';

function parseParams(str) {
  const params = {};
  if (!str) return params;
  str.split('&').forEach((pair) => {
    if (!pair) return;
    const idx = pair.indexOf('=');
    const key = decodeURIComponent((idx === -1 ? pair : pair.slice(0, idx)).replace(/\+/g, ' '));
    const value = idx === -1 ? '' : decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, ' '));
    params[key] = value;
  });
  return params;
}

// Returns null if the URL isn't a password-reset link, otherwise
// { accessToken, refreshToken, code, error } (whichever are present).
export function parsePasswordResetUrl(url) {
  if (!url || typeof url !== 'string') return null;

  const hashIdx = url.indexOf('#');
  const beforeHash = hashIdx === -1 ? url : url.slice(0, hashIdx);
  const hash = hashIdx === -1 ? '' : url.slice(hashIdx + 1);
  const queryIdx = beforeHash.indexOf('?');
  const query = queryIdx === -1 ? '' : beforeHash.slice(queryIdx + 1);
  const params = { ...parseParams(query), ...parseParams(hash) };

  const isResetPath = /reset-password/i.test(beforeHash);
  const isRecovery = params.type === 'recovery';
  if (!isResetPath && !isRecovery) return null;

  if (params.error || params.error_code) {
    return {
      error: {
        code: params.error_code || params.error,
        message: params.error_description || params.error,
      },
    };
  }

  return {
    accessToken: params.access_token || null,
    refreshToken: params.refresh_token || null,
    code: params.code || null,
    error: null,
  };
}

export function friendlyResetLinkError(error) {
  const code = error?.code || '';
  const message = error?.message || '';
  if (code === 'otp_expired' || /expired|invalid/i.test(message)) {
    return 'This password reset link has expired or has already been used. Request a new one from the sign-in screen.';
  }
  if (/network/i.test(message)) {
    return 'Network error. Check your connection and tap the link in your email again.';
  }
  return 'This password reset link could not be opened. Request a new one from the sign-in screen.';
}
