import { useEffect } from 'react';

// Keeps every screen's copy of a post's like state in agreement. Each screen
// holds its own array of post objects (the Following feed, the profile
// grids, the ProfileFeed opened from them), so a like made in one never
// reached the others: going back to a grid showed the old count, and
// reopening the post seeded the viewer from that stale object again.
//
// FeedScreen publishes the likes made on its slides when it loses focus
// (see its flush in useFocusEffect); any screen holding posts subscribes
// with useLikeSync and patches its own array in place, so a grid tile is
// right the moment the user comes back, with no refetch.

const listeners = new Set();

// updates: Array<{ id, likes, liked }>
export function publishLikeChanges(updates) {
  if (!updates || updates.length === 0) return;
  listeners.forEach((listener) => {
    try {
      listener(updates);
    } catch (err) {
      console.error('Like sync listener failed:', err);
    }
  });
}

export function subscribeLikeChanges(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Returns `posts` with each updated post's likes/isLiked replaced, or the
// same array when none of the updates apply (so React skips the re-render).
export function applyLikeUpdates(posts, updates) {
  const byId = new Map(updates.map((u) => [u.id, u]));
  let changed = false;
  const next = posts.map((p) => {
    const u = byId.get(p.id);
    if (!u || (p.likes === u.likes && p.isLiked === u.liked)) return p;
    changed = true;
    return { ...p, likes: u.likes, isLiked: u.liked };
  });
  return changed ? next : posts;
}

// Patches a posts array held in useState whenever likes are published.
// `setPosts` must be a stable state setter.
export function useLikeSync(setPosts) {
  useEffect(
    () => subscribeLikeChanges((updates) => setPosts((prev) => applyLikeUpdates(prev, updates))),
    [setPosts]
  );
}
