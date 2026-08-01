import { supabase } from './supabase';
import { mapRow as mapPostRow } from './posts';

// The current Shot of the Week, computed server-side by
// calculate_shot_of_week() (see supabase/schema.sql) and pinned to the top
// of the Feed pill until it's replaced the following Friday.
export async function getCurrentShotOfWeek() {
  const { data, error } = await supabase
    .from('shot_of_week')
    .select('week_start, posts(*, profiles!posts_user_id_profiles_fkey(username, full_name, avatar_url))')
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.posts) return null;
  return mapPostRow(data.posts);
}
