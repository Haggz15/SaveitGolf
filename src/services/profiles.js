import { supabase } from './supabase';

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
export async function insertProfile(userId, { username, fullName, homeState, handicap } = {}) {
  const payload = { user_id: userId };

  if (username !== undefined) payload.username = username;
  if (fullName !== undefined) payload.full_name = fullName;
  if (homeState !== undefined) payload.home_state = homeState;
  if (handicap !== undefined) payload.handicap = handicap;

  const { data, error } = await supabase
    .from('profiles')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}
