// Sends an "Update Available" push notification to every user with a saved
// Expo push token (profiles.push_token).
//
// Secrets are read from the gitignored .env at the repo root:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Usage:
//   node scripts/send-update-notification.js --dry-run   # count tokens, send nothing
//   node scripts/send-update-notification.js             # send for real

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100; // Expo's per-request maximum
const PAGE_SIZE = 1000; // Supabase's default max rows per select

const TITLE = 'Update Available 🏌️';
const BODY = 'A new update for SaveitGolf is available! Head to the App Store to get the latest version.';

const dryRun = process.argv.includes('--dry-run');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const isExpoToken = (t) => /^Expo(nent)?PushToken\[.+\]$/.test(t);

async function fetchTokens() {
  const tokens = new Set();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('profiles')
      .select('push_token')
      .not('push_token', 'is', null)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    for (const row of data) {
      const t = row.push_token && row.push_token.trim();
      if (t && isExpoToken(t)) tokens.add(t);
    }
    if (data.length < PAGE_SIZE) break;
  }
  return [...tokens];
}

async function sendBatch(tokens) {
  const messages = tokens.map((to) => ({ to, title: TITLE, body: BODY, sound: 'default' }));
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || !Array.isArray(json.data)) {
    throw new Error(`Expo push request failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json.data; // one ticket per message, same order
}

async function main() {
  const tokens = await fetchTokens();
  console.log(`Found ${tokens.length} unique Expo push token(s).`);
  if (dryRun || tokens.length === 0) {
    if (dryRun) console.log('Dry run — nothing sent.');
    return;
  }

  let ok = 0;
  let failed = 0;
  const batches = Math.ceil(tokens.length / BATCH_SIZE);
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const n = i / BATCH_SIZE + 1;
    try {
      const tickets = await sendBatch(batch);
      tickets.forEach((ticket, j) => {
        if (ticket.status === 'ok') {
          ok++;
        } else {
          failed++;
          console.warn(`  ✗ ${batch[j]}: ${ticket.message}${ticket.details?.error ? ` (${ticket.details.error})` : ''}`);
        }
      });
      console.log(`Batch ${n}/${batches}: sent ${batch.length}`);
    } catch (err) {
      failed += batch.length;
      console.error(`Batch ${n}/${batches} failed: ${err.message}`);
    }
  }

  console.log(`Done. ${ok} accepted, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
