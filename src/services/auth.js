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

// Deletes the signed-in user's row from auth.users via a security-definer
// RPC (see delete_own_account in schema.sql) — every app table cascades off
// that FK, so this alone removes posts, scorecards, comments, likes,
// notifications, rankings, my_courses, follows, reports, tags, and the
// profile itself, and the account can't be signed back into afterward.
export async function deleteAccount() {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;
}
