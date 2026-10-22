// One-time lookup: finds the golfcourseapi.com id for posts that were saved
// with a course_name but a null course_id, and prints UPDATE statements to
// run by hand in the Supabase SQL editor. Reads nothing from and writes
// nothing to the database itself.
//
// Secrets are read from the gitignored .env at the repo root:
//   GOLF_COURSE_API_KEY
//
// Usage:
//   node scripts/fix-null-course-ids.js
//
// Each search costs one API request against the daily quota.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE_URL = 'https://api.golfcourseapi.com/v1';

// Exactly as they appear in posts.course_name — the generated UPDATEs match
// on this text, so it has to be the stored value, not a cleaned-up one.
// Names passed as arguments replace this list:
//   node scripts/fix-null-course-ids.js "Quail Hollow Club" "Oakmont"
const COURSE_NAMES = process.argv.length > 2 ? process.argv.slice(2) : [
  'Augusta National Golf Club',
  'Glenmaura National Golf Club',
  'Mountain View Country Club',
  'Oakmont',
  'Pebble Beach Golf Links',
];

const apiKey = process.env.GOLF_COURSE_API_KEY || process.env.EXPO_PUBLIC_GOLF_COURSE_API_KEY;
if (!apiKey) {
  console.error('Missing GOLF_COURSE_API_KEY in .env');
  process.exit(1);
}

async function searchCourses(query) {
  const res = await fetch(`${BASE_URL}/search?search_query=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Key ${apiKey}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)}`);
  return (body?.courses ?? []).map((c) => ({
    id: c.id != null ? String(c.id) : null,
    name: c.club_name || c.course_name,
    city: c.location?.city ?? null,
    state: c.location?.state ?? null,
  }));
}

const norm = (s) => (s ?? '').toLowerCase().trim();

// Exact name match beats a name containing the query, which beats anything
// else. Within the best tier, entries are grouped by name + city and the
// alphabetically lowest id wins — the same canonical id the app's
// dedupeCourseResults stores, so fixed posts group with ones posted since.
function pickBestMatch(query, results) {
  const q = norm(query);
  const withId = results.filter((r) => r.id);
  const tiers = [
    withId.filter((r) => norm(r.name) === q),
    withId.filter((r) => norm(r.name).includes(q)),
    withId,
  ];
  const tier = tiers.find((t) => t.length > 0);
  if (!tier) return null;
  return [...tier].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
}

const sqlString = (s) => `'${String(s).replace(/'/g, "''")}'`;

async function main() {
  const updates = [];

  for (const name of COURSE_NAMES) {
    console.log(`\n=== ${name} ===`);
    let results;
    try {
      results = await searchCourses(name);
    } catch (err) {
      console.error(`  search failed: ${err.message}`);
      continue;
    }
    if (results.length === 0) {
      console.log('  no results');
      continue;
    }

    // Every candidate is listed so an ambiguous name (several "Mountain View
    // Country Club"s) can be checked by eye before running its UPDATE.
    for (const r of results) {
      console.log(`  ${r.id}  ${r.name}  (${[r.city, r.state].filter(Boolean).join(', ') || 'location unknown'})`);
    }

    const best = pickBestMatch(name, results);
    if (!best) {
      console.log('  no result with an id');
      continue;
    }
    // More than one distinct course (name + city) means the lowest-id pick is
    // arbitrary — no UPDATE is generated, pick the right id from the list.
    const distinct = new Set(results.filter((r) => r.id).map((r) => `${norm(r.name)}|${norm(r.city)}`));
    if (distinct.size > 1) {
      console.log('  !! ambiguous — no UPDATE generated, choose the right id from the list above');
      continue;
    }
    console.log(`  -> match: ${best.id}  ${best.name}  (${[best.city, best.state].filter(Boolean).join(', ')})`);

    updates.push(
      `update posts set course_id = ${sqlString(best.id)}, manual_entry = false ` +
        `where course_id is null and course_name = ${sqlString(name)};`
    );
  }

  console.log('\n-- Paste into the Supabase SQL editor (check the matches above first):');
  for (const u of updates) console.log(u);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
