import { supabase } from './supabase';

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Used from Profile Setup (Continue and Skip both call this — Skip just
// omits the optional fields) and creates the row if it doesn't exist yet.
export async function saveProfile(userId, { username, fullName, homeState, handicapIndex, avatarUrl, onboardingComplete }) {
  const payload = { id: userId, updated_at: new Date().toISOString() };

  if (username !== undefined) payload.username = username;
  if (fullName !== undefined) payload.full_name = fullName;
  if (homeState !== undefined) payload.home_state = homeState;
  if (handicapIndex !== undefined) payload.handicap_index = handicapIndex;
  if (avatarUrl !== undefined) payload.avatar_url = avatarUrl;
  if (onboardingComplete !== undefined) payload.onboarding_complete = onboardingComplete;

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}
