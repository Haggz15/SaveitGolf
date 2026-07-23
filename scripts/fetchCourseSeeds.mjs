// One-time / resumable seed script: queries the real golfcourseapi.com search
// endpoint for a well-known major city in each state and keeps only results
// the API itself reports as being located in that state. This avoids
// hand-guessing course names — every entry is verified against the live DB.
//
// Usage: node scripts/fetchCourseSeeds.mjs
// Respects the 50 req/day free-tier quota: stops early if it runs out, and is
// safe to re-run later since it skips states already resolved in the output file.

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '../src/data/courses.generated.json');

const API_KEY = process.env.GOLF_COURSE_API_KEY;
if (!API_KEY) {
  console.error('Missing GOLF_COURSE_API_KEY in .env');
  process.exit(1);
}

// state abbreviation -> a major city confidently known to be in that state
const STATE_CITY_SEEDS = {
  AL: 'Birmingham', AK: 'Anchorage', AZ: 'Phoenix', AR: 'Little Rock',
  CA: 'Los Angeles', CO: 'Denver', CT: 'Hartford', DE: 'Wilmington',
  FL: 'Miami', GA: 'Atlanta', HI: 'Honolulu', ID: 'Boise',
  IL: 'Chicago', IN: 'Indianapolis', IA: 'Des Moines', KS: 'Wichita',
  KY: 'Louisville', LA: 'New Orleans', ME: 'Portland', MD: 'Baltimore',
  MA: 'Boston', MI: 'Detroit', MN: 'Minneapolis', MS: 'Jackson',
  MO: 'Kansas City', MT: 'Billings', NE: 'Omaha', NV: 'Las Vegas',
  NH: 'Manchester', NJ: 'Newark', NM: 'Albuquerque', NY: 'New York',
  NC: 'Charlotte', ND: 'Fargo', OH: 'Columbus', OK: 'Oklahoma City',
  OR: 'Portland', PA: 'Philadelphia', RI: 'Providence', SC: 'Charleston',
  SD: 'Sioux Falls', TN: 'Nashville', TX: 'Houston', UT: 'Salt Lake City',
  VT: 'Burlington', VA: 'Virginia Beach', WA: 'Seattle', WV: 'Charleston',
  WI: 'Milwaukee', WY: 'Cheyenne',
};

const DAILY_QUOTA = 50;

function loadExisting() {
  if (!fs.existsSync(OUT_PATH)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
    const byState = {};
    for (const course of data) byState[course.state] = course;
    return byState;
  } catch {
    return {};
  }
}

async function searchCourses(query) {
  const url = `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Authorization: `Key ${API_KEY}` } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for query "${query}"`);
  }
  const data = await res.json();
  return data.courses ?? [];
}

async function main() {
  const resolved = loadExisting();
  const pending = Object.entries(STATE_CITY_SEEDS).filter(([state]) => !resolved[state]);

  console.log(`${Object.keys(resolved).length} states already resolved, ${pending.length} pending.`);

  let requestsUsed = 0;
  for (const [state, city] of pending) {
    if (requestsUsed >= DAILY_QUOTA) {
      console.log(`Hit daily quota of ${DAILY_QUOTA} requests. Stopping — re-run tomorrow to continue.`);
      break;
    }
    try {
      const courses = await searchCourses(city);
      requestsUsed += 1;
      const match = courses.find((c) => c.location?.state?.toUpperCase() === state);
      if (match) {
        resolved[state] = {
          id: match.id,
          name: match.club_name || match.course_name,
          address: match.location.address,
          city: match.location.city,
          state,
        };
        console.log(`✓ ${state}: ${resolved[state].name} (${resolved[state].city})`);
      } else {
        console.log(`✗ ${state}: no course in "${city}" search matched state ${state}`);
      }
    } catch (err) {
      console.log(`! ${state}: ${err.message}`);
    }
    // be gentle with the API
    await new Promise((r) => setTimeout(r, 1800));
  }

  const out = Object.values(resolved).sort((a, b) => a.state.localeCompare(b.state));
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n');
  console.log(`\nWrote ${out.length}/${Object.keys(STATE_CITY_SEEDS).length} states to ${path.relative(process.cwd(), OUT_PATH)}`);
  const missing = Object.keys(STATE_CITY_SEEDS).filter((s) => !resolved[s]);
  if (missing.length) {
    console.log(`Still missing: ${missing.join(', ')}`);
  }
}

main();
