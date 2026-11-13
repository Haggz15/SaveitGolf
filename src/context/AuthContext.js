import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';

import { supabase } from '../services/supabase';
import { parsePasswordResetUrl, friendlyResetLinkError } from '../services/authDeepLink';
import { getProfile, insertProfile, updateProfile as updateProfileRequest } from '../services/profiles';
import { registerForPushNotifications } from '../services/pushNotifications';
import { followUser } from '../services/social';

// SaveitGolf's own account — auto-followed by every new user on signup.
const DEFAULT_FOLLOW_USER_ID = 'b5c2931d-47ed-427e-85c0-c5073c53fc1f';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [initializing, setInitializing] = useState(true);
  // Set when Supabase's PASSWORD_RECOVERY auth event fires (Fix 9) — the
  // web build lands here with a real, but temporary, session straight from
  // the emailed reset link's token (see supabase.js's detectSessionInUrl).
  // RootNavigator checks this ahead of the normal session-based routing so
  // that temporary session opens ResetPasswordScreen instead of dropping the
  // user straight into the main app under someone else's still-open link.
  const [passwordRecovery, setPasswordRecovery] = useState(false);

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

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      setSession(nextSession);
      await loadProfile(nextSession?.user?.id);
      setInitializing(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Native password-reset deep link (com.saveitgolf.app://reset-password).
  // detectSessionInUrl is web-only, so on native we pull the tokens out of
  // the link ourselves. setSession fires SIGNED_IN rather than
  // PASSWORD_RECOVERY, so the recovery flag is raised first — that way
  // RootNavigator goes straight to ResetPasswordScreen without flashing the
  // main app.
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    let active = true;
    const handled = new Set();

    const handleUrl = async (url) => {
      const parsed = parsePasswordResetUrl(url);
      if (!parsed || handled.has(url)) return;
      handled.add(url);

      if (parsed.error) {
        Alert.alert('Reset link expired', friendlyResetLinkError(parsed.error));
        return;
      }

      setPasswordRecovery(true);
      try {
        let error;
        if (parsed.accessToken && parsed.refreshToken) {
          ({ error } = await supabase.auth.setSession({
            access_token: parsed.accessToken,
            refresh_token: parsed.refreshToken,
          }));
        } else if (parsed.code) {
          ({ error } = await supabase.auth.exchangeCodeForSession(parsed.code));
        } else {
          error = { code: 'missing_token', message: 'Invalid reset link' };
        }
        if (error) throw error;
      } catch (err) {
        console.warn('[auth] password reset link failed', err);
        if (!active) return;
        setPasswordRecovery(false);
        Alert.alert('Reset link expired', friendlyResetLinkError(err));
      }
    };

    Linking.getInitialURL()
      .then((url) => url && handleUrl(url))
      .catch((err) => console.warn('[auth] getInitialURL failed', err));
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  // Register this device for push once there's a signed-in user with a
  // profile row to store the token on (a brand-new account gets one after
  // onboarding, which re-runs this).
  const userId = session?.user?.id;
  const hasProfile = Boolean(profile);
  useEffect(() => {
    if (userId && hasProfile) registerForPushNotifications(userId);
  }, [userId, hasProfile]);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user?.id);
  }, [loadProfile, session]);

  const completeOnboarding = useCallback(
    async (fields) => {
      if (!session?.user?.id) throw new Error('Not signed in.');
      const row = await insertProfile(session.user.id, fields);
      // Every new account starts out following SaveitGolf's own account, so
      // the Following feed isn't empty on day one. followUser skips an
      // existing follow (unique constraint) and self-follows; never let it
      // block finishing signup.
      await followUser(session.user.id, DEFAULT_FOLLOW_USER_ID).catch((err) =>
        console.warn('[auth] default follow failed', err)
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

  // Clears the recovery flag once ResetPasswordScreen has set a new password
  // — the now-ordinary session hands off to the normal session/needsOnboarding
  // routing in RootNavigator, signing the user straight in.
  const completePasswordRecovery = useCallback(() => {
    setPasswordRecovery(false);
  }, []);

  // "Back to sign in" from ResetPasswordScreen — the recovery session is a
  // real (if temporary) sign-in, so leaving it standing would sign the next
  // person to open the app on this device in as whoever's link this was.
  const cancelPasswordRecovery = useCallback(async () => {
    setPasswordRecovery(false);
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      initializing,
      // profiles has no onboarding_complete flag — the row's existence is the signal.
      needsOnboarding: Boolean(session?.user) && !profile,
      passwordRecovery,
      refreshProfile,
      completeOnboarding,
      updateProfile,
      completePasswordRecovery,
      cancelPasswordRecovery,
    }),
    [
      session,
      profile,
      initializing,
      passwordRecovery,
      refreshProfile,
      completeOnboarding,
      updateProfile,
      completePasswordRecovery,
      cancelPasswordRecovery,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
