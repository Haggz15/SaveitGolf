import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '../services/supabase';
import { getProfile, insertProfile, updateProfile as updateProfileRequest } from '../services/profiles';
import { followUser } from '../services/social';

const AuthContext = createContext(null);

const FOUNDER_USER_ID = 'b5c2931d-47ed-427e-85c0-c5073c53fc1f';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    try {
      const row = await getProfile(userId);
      setProfile(row);
    } catch (err) {
      console.warn('[auth] failed to load profile', err);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      await loadProfile(data.session?.user?.id);
      if (mounted) setInitializing(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      await loadProfile(nextSession?.user?.id);
      setInitializing(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user?.id);
  }, [loadProfile, session]);

  const completeOnboarding = useCallback(
    async (fields) => {
      if (!session?.user?.id) throw new Error('Not signed in.');
      const row = await insertProfile(session.user.id, fields);
      followUser(session.user.id, FOUNDER_USER_ID).catch((err) =>
        console.error('Auto follow founder error:', err)
      );
      setProfile(row);
      return row;
    },
    [session]
  );

  const updateProfile = useCallback(
    async (fields) => {
      if (!session?.user?.id) throw new Error('Not signed in.');
      const row = await updateProfileRequest(session.user.id, fields);
      setProfile(row);
      return row;
    },
    [session]
  );

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      initializing,
      // profiles has no onboarding_complete flag — the row's existence is the signal.
      needsOnboarding: Boolean(session?.user) && !profile,
      refreshProfile,
      completeOnboarding,
      updateProfile,
    }),
    [session, profile, initializing, refreshProfile, completeOnboarding, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
