import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '../services/supabase';
import { getUnreadNotificationCount, markAllNotificationsRead } from '../services/notifications';
import { useAuth } from './AuthContext';

const NotificationsContext = createContext(null);

// Single source of truth for "how many unread notifications does the
// current user have" — read by the bell badge in FeedScreen's header, the
// only place an unread count is shown (no tab badges), so a realtime insert
// or a markAllRead only has to update state in one place.
export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshCounts = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    try {
      setUnreadCount(await getUnreadNotificationCount(userId));
    } catch (err) {
      console.error('Failed to load unread notification counts:', err);
    }
  }, [userId]);

  // No polling — counts load once here, then refresh on manual pull-to-refresh
  // / logo tap (FeedScreen) or via the realtime top-up below.
  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  // Realtime top-up so the badge updates the instant a new notification
  // lands — only INSERT matters here since reads are already reflected
  // locally by whoever marked them.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => setUnreadCount((count) => count + 1)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    try {
      await markAllNotificationsRead(userId);
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    }
  }, [userId]);

  // Optimistic decrement for a single notification read outside of
  // markAllRead (tapping one in the panel before its 3s auto-read timer
  // fires) — clamped so a stale double-decrement can't go negative.
  const decrementUnread = useCallback(() => {
    setUnreadCount((count) => Math.max(0, count - 1));
  }, []);

  const value = useMemo(
    () => ({ unreadCount, refreshCounts, markAllRead, decrementUnread }),
    [unreadCount, refreshCounts, markAllRead, decrementUnread]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
}
