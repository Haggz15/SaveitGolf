// Simplified approximation: an average score of 72 (par) maps to a 0
// handicap, with each stroke over par worth roughly 0.8 handicap strokes.
export function estimateHandicapFromAverageScore(averageScore) {
  const estimate = (averageScore - 72) * 0.8;
  return Math.round(estimate * 10) / 10;
}

// Plus handicaps (better than scratch) are entered with a leading "+" and
// stored as negative numbers in profiles.handicap_index, so "+2.1" → -2.1.
// Returns null when the text isn't a valid handicap.
export function parseHandicapInput(text) {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return null;
  const isPlus = trimmed.startsWith('+');
  const digits = isPlus ? trimmed.slice(1) : trimmed;
  if (!/^(\d+\.?\d*|\.\d+)$/.test(digits)) return null;
  const value = parseFloat(digits);
  return isPlus ? -value : value;
}

// Keeps only digits, "." and a single leading "+" while typing.
export function sanitizeHandicapInput(text) {
  const cleaned = (text ?? '').replace(/[^0-9+.]/g, '');
  const isPlus = cleaned.startsWith('+');
  return (isPlus ? '+' : '') + cleaned.replace(/\+/g, '');
}

// Display counterpart of parseHandicapInput: negative stored values render
// as plus handicaps ("+2.1").
export function formatHandicap(value) {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(value);
  if (Number.isNaN(num)) return '--';
  if (num < 0) return `+${Math.abs(num)}`;
  return String(num);
}
