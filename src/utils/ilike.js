// Escapes ilike's wildcards so a value is matched literally — only case is
// ignored, never "%"/"_" in e.g. a course name acting as a pattern.
export function escapeIlike(value) {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// PostgREST's .or() syntax reserves , . : ( ) inside values — course names
// and search text routinely have commas and periods — so values are
// double-quoted, which makes PostgREST treat a backslash as an escape: `\`
// and `"` need one more level (keeping escapeIlike's `\%`/`\_` intact
// through to ilike).
export function quoteOrValue(value) {
  return `"${String(value).replace(/[\\"]/g, (ch) => `\\${ch}`)}"`;
}
