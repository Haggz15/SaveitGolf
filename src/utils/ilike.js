// Escapes ilike's wildcards so a value is matched literally — only case is
// ignored, never "%"/"_" in e.g. a course name acting as a pattern.
export function escapeIlike(value) {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
