import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '../services/supabase';
import {
  getUnreadNotificationCount,
  getUnreadFollowNotificationCount,
  markAllNotificationsRead,
} from '../services/notifications';
import { useAuth } from './AuthContext';

const NotificationsContext = createContext(null);

const POLL_INTERVAL_MS = 30000;

// Single source of truth for "how many unread notifications does the
// current user have" — the bell badge in FeedScreen's header and the
// Profile tab badge in RootNavigator both read from here instead of each
// running their own query/poll, so a realtime insert or a markAllRead only
// has to update state in one place to be reflected everywhere.
export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [unreadCount, setUnreadCount] = useState(0);
  const [followUnreadCount, setFollowUnreadCount] = useState(0);

  const refreshCounts = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      setFollowUnreadCount(0);
      return;
    }
    try {
      const [total, follows] = await Promise.all([
        getUnreadNotificationCount(userId),
        getUnreadFollowNotificationCount(userId),
      ]);
      setUnreadCount(total);
      setFollowUnreadCount(follows);
    } catch (err) {
      console.error('Failed to load unread notification counts:', err);
    }
  }, [userId]);

  useEffect(() => {
    refreshCounts();
    const interval = setInterval(refreshCounts, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshCounts]);

  // Realtime top-up so the badge updates the instant a new notification
  // lands, rather than waiting for the next 30s poll — only INSERT matters
  // here since reads are already reflected locally by whoever marked them.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setUnreadCount((count) => count + 1);
          if (payload.new?.type === 'follow') {
            setFollowUnreadCount((count) => count + 1);
          }
        }
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
      setFollowUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    }
  }, [userId]);

  // Optimistic decrement for a single notification read outside of
  // markAllRead (tapping one in the panel before its 3s auto-read timer
  // fires) — clamped so a stale double-decrement can't go negative.
  const decrementUnread = useCallback((wasFollow) => {
    setUnreadCount((count) => Math.max(0, count - 1));
    if (wasFollow) setFollowUnreadCount((count) => Math.max(0, count - 1));
  }, []);

  const value = useMemo(
    () => ({ unreadCount, followUnreadCount, refreshCounts, markAllRead, decrementUnread }),
    [unreadCount, followUnreadCount, refreshCounts, markAllRead, decrementUnread]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
}
