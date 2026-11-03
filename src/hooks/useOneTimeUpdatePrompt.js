import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAppStoreUpdate } from '../services/appVersion';

// The App Store version the update prompt was last shown for.
const SHOWN_FOR_VERSION_KEY = 'updatePromptShownForVersion';

// Shows the "Update Available" prompt at most ONCE per App Store release.
//
// The old prompt reappeared on every launch because nothing remembered it
// had been seen. Here the version is saved *before* the prompt is shown, so
// closing the app, force-quitting, or reopening it later never brings it
// back — not even if the user ignored it without tapping a button. It only
// returns once a newer release than that one is in the App Store.
//
// If the saved value can't be read or written, the prompt is skipped
// rather than risk showing it again on every launch.
export function useOneTimeUpdatePrompt() {
  const [update, setUpdate] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const available = await getAppStoreUpdate();
        if (!available || cancelled) return;
        const shownFor = await AsyncStorage.getItem(SHOWN_FOR_VERSION_KEY);
        if (shownFor === available.latestVersion) return;
        await AsyncStorage.setItem(SHOWN_FOR_VERSION_KEY, available.latestVersion);
        if (!cancelled) setUpdate(available);
      } catch (err) {
        console.log('Update prompt check skipped:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(() => setUpdate(null), []);

  return { update, dismiss };
}
