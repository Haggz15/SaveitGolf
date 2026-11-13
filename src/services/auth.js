import { supabase } from './supabase';

export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Emails a recovery link (Fix 9). `redirectTo` is
// com.saveitgolf.app://reset-password on native (handled by AuthContext's
// deep-link listener) and the site's /reset-password on web (handled by
// detectSessionInUrl). It has to be allow-listed in the Supabase dashboard
// under Authentication > URL Configuration > Redirect URLs.
export async function requestPasswordReset(email, redirectTo) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

// Called from ResetPasswordScreen once the recovery link has landed the user
// in a (temporary) recovery session — sets it as their real password going
// forward.
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// Deletes the signed-in user's row from auth.users via a security-definer
// RPC (see delete_own_account in schema.sql) — every app table cascades off
// that FK, so this alone removes posts, scorecards, comments, likes,
// notifications, rankings, my_courses, follows, reports, tags, and the
// profile itself, and the account can't be signed back into afterward.
export async function deleteAccount() {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;
}
