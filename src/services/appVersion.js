import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Compares dotted version strings numerically ("1.0.10" > "1.0.9").
// Returns true when `latest` is strictly newer than `current`.
export function isNewerVersion(latest, current) {
  const a = String(latest).split('.').map((n) => parseInt(n, 10) || 0);
  const b = String(current).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

// Looks up this platform's row in app_versions (see supabase/schema.sql).
// Resolves to { latestVersion, storeUrl } when the installed build is older
// than the latest store release, otherwise null.
export async function getStoreUpdate() {
  const currentVersion = Constants.expoConfig?.version;
  if (!currentVersion || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return null;

  const { data, error } = await supabase
    .from('app_versions')
    .select('latest_version, store_url')
    .eq('platform', Platform.OS)
    .maybeSingle();

  if (error) throw error;
  if (!data || !isNewerVersion(data.latest_version, currentVersion)) return null;

  return { latestVersion: data.latest_version, storeUrl: data.store_url };
}
