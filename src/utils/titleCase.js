// Small words that stay lowercase unless they start the name.
const MINOR_WORDS = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to']);

function capitalizeFirstLetter(part) {
  const index = part.search(/[a-z]/i);
  if (index < 0) return part;
  return part.slice(0, index) + part[index].toUpperCase() + part.slice(index + 1);
}

// "broomsedge golf club" -> "Broomsedge Golf Club",
// "club at the dunes" -> "Club at the Dunes". Only first letters are
// raised, so deliberate capitals ("TPC", "McArthur") survive; a name typed
// entirely in caps is lowercased first so it doesn't stay shouting.
// Hyphenated parts are each capitalized ("lake-side" -> "Lake-Side").
export function toTitleCase(value) {
  if (value == null) return value;
  const text = String(value).trim().replace(/\s+/g, ' ');
  if (!text) return text;
  const base = /[a-z]/.test(text) ? text : text.toLowerCase();
  return base
    .split(' ')
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && MINOR_WORDS.has(lower)) return lower;
      return word.split('-').map(capitalizeFirstLetter).join('-');
    })
    .join(' ');
}

export default toTitleCase;
