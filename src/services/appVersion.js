import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';

const APP_STORE_LOOKUP_URL = 'https://itunes.apple.com/lookup?bundleId=com.saveitgolf.app';

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

// Asks the App Store for the live version of this app. Resolves to
// { latestVersion, storeUrl } when the installed build is older, otherwise
// null. iOS production builds only — dev and TestFlight builds never prompt.
//
// The installed version comes from the native binary
// (Application.nativeApplicationVersion), not app.config.js: an OTA update
// carries the newer config's version string, which would make an old binary
// look up to date.
export async function getAppStoreUpdate() {
  if (__DEV__ || Platform.OS !== 'ios' || Updates.channel !== 'production') return null;

  const currentVersion = Application.nativeApplicationVersion;
  if (!currentVersion) return null;

  const res = await fetch(APP_STORE_LOOKUP_URL);
  if (!res.ok) throw new Error(`App Store lookup failed: ${res.status}`);
  const json = await res.json();
  const listing = json.results?.[0];
  if (!listing?.version || !isNewerVersion(listing.version, currentVersion)) return null;

  // itms-apps:// opens the App Store app directly instead of Safari.
  const storeUrl = listing.trackId
    ? `itms-apps://apps.apple.com/app/id${listing.trackId}`
    : listing.trackViewUrl;
  return { latestVersion: listing.version, storeUrl };
}
