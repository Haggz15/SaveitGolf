// Codes that can come back on the redirect URL from an OAuth provider (e.g.
// ?error=access_denied), as opposed to Supabase's own error codes below.
const OAUTH_ERROR_MESSAGES = {
  access_denied: 'Sign-in was cancelled.',
  server_error: 'The sign-in provider ran into an error. Please try again.',
  temporarily_unavailable: 'Sign-in is temporarily unavailable. Please try again in a moment.',
};

// Supabase returns machine-oriented error messages/status codes. Map the
// common ones to copy we're comfortable showing inline on the auth forms.
export function friendlyAuthError(error) {
  if (!error) return '';

  const message = error.message || '';
  const code = error.code || '';

  if (OAUTH_ERROR_MESSAGES[code]) {
    return OAUTH_ERROR_MESSAGES[code];
  }
  if (/unsupported provider/i.test(message) || /provider is not enabled/i.test(message)) {
    return 'That sign-in method isn\'t available right now. Please use email instead.';
  }
  if (code === 'user_already_exists' || /already registered/i.test(message)) {
    return 'An account with that email already exists. Try logging in instead.';
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return 'Incorrect email or password.';
  }
  if (code === 'weak_password' || /password.*at least/i.test(message)) {
    return 'Password must be at least 6 characters.';
  }
  if (/invalid email/i.test(message)) {
    return 'Enter a valid email address.';
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return 'Please confirm your email before logging in.';
  }
  if (code === 'over_email_send_rate_limit' || /rate limit/i.test(message)) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (/network/i.test(message)) {
    return 'Network error. Check your connection and try again.';
  }
  if (/username/i.test(message) && /(unique|duplicate|taken)/i.test(message)) {
    return 'That username is already taken.';
  }

  return message || 'Something went wrong. Please try again.';
}
