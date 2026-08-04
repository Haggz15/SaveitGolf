// Email confirmation is disabled project-wide, so this should never surface
// in normal use — it only exists to catch a stale unconfirmed flag on an
// account created before that setting was turned off. Callers use this to
// retry silently instead of showing the user a "verify your email" message.
export function isEmailNotConfirmedError(error) {
  if (!error) return false;
  const message = error.message || '';
  const code = error.code || '';
  return code === 'email_not_confirmed' || /email not confirmed/i.test(message);
}

// Supabase returns machine-oriented error messages/status codes. Map the
// common ones to copy we're comfortable showing inline on the auth forms.
export function friendlyAuthError(error) {
  if (!error) return '';

  const message = error.message || '';
  const code = error.code || '';

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
