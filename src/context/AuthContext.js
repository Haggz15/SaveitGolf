import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '../services/supabase';
import { getProfile, saveProfile } from '../services/profiles';

const AuthContext = createContext(null);

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
      const row = await saveProfile(session.user.id, { ...fields, onboardingComplete: true });
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
      needsOnboarding: Boolean(session?.user) && !profile?.onboarding_complete,
      refreshProfile,
      completeOnboarding,
    }),
    [session, profile, initializing, refreshProfile, completeOnboarding]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
