import { useEffect, useRef, useState } from 'react';
import { getTaggedPosts } from '../services/posts';

// Lazily loads the posts `userId` is tagged in for a profile's Tagged Posts
// tab: nothing is fetched until `active` (the tab is selected) first turns
// true, and the result is kept for the rest of the screen's life, so
// switching tabs away and back never refetches. A different `userId` starts
// over.
export function useTaggedPosts(userId, active) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const fetchedForRef = useRef(null);

  useEffect(() => {
    if (!active || !userId || fetchedForRef.current === userId) return;
    fetchedForRef.current = userId;
    setPosts([]);
    setLoading(true);
    // Not cancelled when the tab is left mid-fetch — the result is still
    // wanted for when it's shown again. Only a newer userId discards it.
    const isCurrent = () => fetchedForRef.current === userId;
    getTaggedPosts(userId)
      .then((rows) => {
        if (isCurrent()) setPosts(rows);
      })
      .catch((err) => {
        console.error('Failed to load tagged posts:', err);
        // Let the next visit to the tab try again.
        if (isCurrent()) fetchedForRef.current = null;
      })
      .finally(() => {
        if (isCurrent() || fetchedForRef.current === null) setLoading(false);
      });
  }, [userId, active]);

  return { posts, loading };
}
