import 'react-native-url-polyfill/auto';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Expo inlines process.env.EXPO_PUBLIC_* automatically, but SUPABASE_URL /
// SUPABASE_ANON_KEY aren't EXPO_PUBLIC_-prefixed, so they only reach the
// client via app.config.js's `extra` field (read through expo-constants).
// process.env.* is checked too in case a bundler define/inlining step sets it.
const SUPABASE_URL =
  Constants.expoConfig?.extra?.supabaseUrl ||
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

console.log(
  '[supabase] SUPABASE_URL is',
  SUPABASE_URL ? 'defined' : 'undefined',
  '| SUPABASE_ANON_KEY is',
  SUPABASE_ANON_KEY ? 'defined' : 'undefined'
);

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isSupabaseConfigured) {
  console.warn(
    '[supabase] SUPABASE_URL or SUPABASE_ANON_KEY is undefined — check .env and app.config.js. ' +
      'Falling back to a placeholder client; auth calls will fail until real credentials are set.'
  );
}

// createClient throws synchronously on an invalid URL, which would crash the
// app at import time before any screen renders. Fall back to a syntactically
// valid placeholder so the app boots and shows real (network) errors from the
// auth forms instead, once real credentials are missing.
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
