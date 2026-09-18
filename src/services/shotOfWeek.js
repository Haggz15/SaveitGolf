import { supabase } from './supabase';
import { mapRow as mapPostRow } from './posts';

// The current Shot of the Week, computed server-side by
// calculate_shot_of_week() (see supabase/schema.sql) and pinned to the top
// of the Feed pill until it's replaced the following Friday. Two queries
// (pointer row, then the post itself) rather than one embedded select so a
// post that's since been deleted (FK is `on delete cascade`, so this can't
// actually dangle, but a moderation-hidden post still counts) fails the
// second query cleanly instead of a join silently coming back empty.
export async function getCurrentShotOfWeek() {
  const { data: shotData, error: shotError } = await supabase
    .from('shot_of_week')
    .select('post_id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (shotError) throw shotError;
  if (!shotData?.post_id) return null;

  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('*, profiles!posts_user_id_profiles_fkey(username, full_name, avatar_url)')
    .eq('id', shotData.post_id)
    .maybeSingle();

  if (postError) throw postError;
  if (!post) return null;

  console.log('Shot of the week loaded:', post.id);
  return mapPostRow(post);
}
