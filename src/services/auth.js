import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { getQueryParams } from 'expo-auth-session/build/QueryParams';

import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

// The web build (expo export --platform web) is deployed to this domain, so
// on web we can send OAuth/email-confirmation redirects straight there and
// let supabase-js pick up the session from the URL on load (see
// detectSessionInUrl in ./supabase.js). Native platforms use a dynamic
// deep-link redirect instead — see signInWithOAuthPopup below.
const WEB_REDIRECT_URL = 'https://saveitgolf.com';

function oauthErrorFromCode(errorCode) {
  const err = new Error(`OAuth sign-in failed (${errorCode}).`);
  err.code = errorCode;
  return err;
}

// Native flow: opens the provider's consent page in a browser tab and waits
// for it to redirect back to a URL the app itself owns (an exp:// or
// saveitgolf:// deep link), then hands the tokens from that redirect to
// Supabase. This is what actually works without Universal Links/App Links
// configured, which this project doesn't have set up yet.
async function signInWithOAuthPopup(provider) {
  const redirectTo = AuthSession.makeRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) return null;

  const { params, errorCode } = getQueryParams(result.url);
  if (errorCode) throw oauthErrorFromCode(errorCode);

  const { access_token: accessToken, refresh_token: refreshToken } = params;
  if (!accessToken || !refreshToken) return null;

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) throw sessionError;
  return sessionData;
}

// Web flow: full-page redirect to the provider, which redirects back to
// saveitgolf.com; supabase-js picks the session up from the URL on load.
async function signInWithOAuthRedirect(provider) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: WEB_REDIRECT_URL },
  });
  if (error) throw error;
  return null;
}

export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Returns null if the user backed out of the Apple sheet instead of throwing,
// so callers don't need to special-case cancellation as an error.
export async function signInWithApple() {
  if (Platform.OS === 'web') return signInWithOAuthRedirect('apple');
  if (Platform.OS !== 'ios') return signInWithOAuthPopup('apple');

  let credential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (err) {
    if (err.code === 'ERR_REQUEST_CANCELED') return null;
    throw err;
  }

  if (!credential.identityToken) {
    throw new Error('No identity token returned from Apple.');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
  return data;
}

// Requires the Google provider to be configured with a client ID/secret in
// the Supabase dashboard (Authentication > Providers > Google).
export async function signInWithGoogle() {
  if (Platform.OS === 'web') return signInWithOAuthRedirect('google');
  return signInWithOAuthPopup('google');
}
