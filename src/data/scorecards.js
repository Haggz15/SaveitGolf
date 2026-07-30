import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'saveitgolf.scorecards.v1';

export async function getScorecards() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function getLatestScorecard() {
  const all = await getScorecards();
  return all[0] ?? null;
}

export async function saveScorecard(scorecard) {
  const existing = await getScorecards();
  const updated = [scorecard, ...existing];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
