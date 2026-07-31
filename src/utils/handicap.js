// Simplified approximation: an average score of 72 (par) maps to a 0
// handicap, with each stroke over par worth roughly 0.8 handicap strokes.
export function estimateHandicapFromAverageScore(averageScore) {
  const estimate = (averageScore - 72) * 0.8;
  return Math.round(estimate * 10) / 10;
}
