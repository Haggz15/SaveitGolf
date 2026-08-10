import { supabase } from './supabase';
import { searchProfiles } from './social';

// Shared by caption tagging (PostScreen) and comment tagging (CommentSheet)
// so "@" detection, suggestion search, and mention resolution all behave
// identically wherever someone types a mention.
export const MENTION_RE = /@(\w+)/g;
const TRAILING_MENTION_RE = /(?:^|\s)@(\w*)$/;
const MENTION_SUGGESTION_LIMIT = 5;

// Returns the in-progress "@quer" the cursor is currently sitting after
// (empty string right after a bare "@"), or null when the text doesn't end
// mid-mention — used to decide whether the suggestion dropdown is open.
export function getTrailingMentionQuery(text) {
  const match = text.match(TRAILING_MENTION_RE);
  return match ? match[1] : null;
}

// Replaces the trailing "@quer" with the full "@username " the user picked.
export function insertMention(text, username) {
  return text.replace(TRAILING_MENTION_RE, (match) => (match.startsWith(' ') ? ` @${username} ` : `@${username} `));
}

export async function searchMentionCandidates(query, currentUserId) {
  const results = await searchProfiles(query, currentUserId);
  return results.slice(0, MENTION_SUGGESTION_LIMIT);
}

// Extracts unique @usernames referenced in free text (a caption or comment)
// and resolves them to profile user_ids — used to insert post_tags rows and
// to fan out "tagged"/"mentioned" notifications after the text is saved.
export async function resolveMentionedUserIds(text) {
  const usernames = [...new Set([...text.matchAll(MENTION_RE)].map((m) => m[1].toLowerCase()))];
  if (usernames.length === 0) return [];

  const { data, error } = await supabase.from('profiles').select('user_id, username').in('username', usernames);

  if (error) throw error;
  return (data ?? []).map((row) => row.user_id);
}
