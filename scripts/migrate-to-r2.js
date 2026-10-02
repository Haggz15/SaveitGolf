// One-time migration: copies every file from the Supabase Storage buckets
// (posts, avatars, scorecards) into their Cloudflare R2 counterparts, then
// rewrites the stored URLs in the database to point at R2.
//
// Secrets are read from the gitignored .env at the repo root:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
//
// Usage:
//   node scripts/migrate-to-r2.js --dry-run   # list what would be copied/updated
//   node scripts/migrate-to-r2.js             # do it
//
// Safe to re-run: uploads overwrite the same key, and only URLs still
// pointing at Supabase Storage get rewritten.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const DRY_RUN = process.argv.includes('--dry-run');

for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
  if (!process.env[name]) {
    console.error(`Missing ${name} in .env`);
    process.exit(1);
  }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Supabase bucket -> R2 bucket, its public base URL, and the DB column that
// stores URLs into it. Matches supabase/functions/r2-presign/index.ts.
const BUCKETS = {
  posts: {
    r2Bucket: 'saveitgolf-posts',
    publicBaseUrl: 'https://pub-292a83d83c614c4e838b6a90259dc020.r2.dev',
    table: 'posts',
    column: 'media_url',
  },
  avatars: {
    r2Bucket: 'saveitgolf-avatars',
    publicBaseUrl: 'https://pub-9c3408f0ad8a4496912f685922400394.r2.dev',
    table: 'profiles',
    column: 'avatar_url',
  },
  scorecards: {
    r2Bucket: 'saveitgolf-scorecards',
    publicBaseUrl: 'https://pub-63731b780f7844598ab59eeb873a9bf2.r2.dev',
    table: 'scorecards',
    column: 'photo_url',
  },
};

const PAGE_SIZE = 1000;

// Recursively lists every file path in a bucket, paging through folders with
// more than PAGE_SIZE entries. Folders come back from list() with id === null.
async function listAllFiles(bucket, prefix = '') {
  const paths = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);

    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        paths.push(...(await listAllFiles(bucket, path)));
      } else if (item.name !== '.emptyFolderPlaceholder') {
        paths.push(path);
      }
    }
    if (data.length < PAGE_SIZE) break;
  }
  return paths;
}

async function copyFiles(bucket, config) {
  const paths = await listAllFiles(bucket);
  console.log(`Found ${paths.length} files`);

  let failed = 0;
  for (const path of paths) {
    if (DRY_RUN) {
      console.log(`  would copy ${path}`);
      continue;
    }
    try {
      const { data: blob, error } = await supabase.storage.from(bucket).download(path);
      if (error) throw new Error(error.message);

      await r2Client.send(new PutObjectCommand({
        Bucket: config.r2Bucket,
        Key: path,
        Body: Buffer.from(await blob.arrayBuffer()),
        ContentType: blob.type || 'application/octet-stream',
      }));
      console.log(`  ✅ ${path}`);
    } catch (err) {
      failed++;
      console.error(`  ❌ ${path}: ${err.message}`);
    }
  }
  return failed;
}

// Rewrites every URL in the table that still points at this Supabase bucket
// to the R2 public URL, keeping the object path and any query string (avatar
// URLs carry a ?t= cache-buster, so exact-match updates would miss them).
async function rewriteUrls(bucket, config) {
  const oldPrefix = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/`;
  const newPrefix = `${config.publicBaseUrl}/`;

  const { data: rows, error } = await supabase
    .from(config.table)
    .select(`id, ${config.column}`)
    .like(config.column, `${oldPrefix}%`);
  if (error) throw new Error(`select ${config.table}: ${error.message}`);

  console.log(`Rewriting ${rows.length} ${config.table}.${config.column} URLs`);
  let failed = 0;
  for (const row of rows) {
    const newUrl = newPrefix + row[config.column].slice(oldPrefix.length);
    if (DRY_RUN) {
      console.log(`  would set ${row.id} -> ${newUrl}`);
      continue;
    }
    const { error: updateError } = await supabase
      .from(config.table)
      .update({ [config.column]: newUrl })
      .eq('id', row.id);
    if (updateError) {
      failed++;
      console.error(`  ❌ ${row.id}: ${updateError.message}`);
    }
  }
  return failed;
}

async function main() {
  if (DRY_RUN) console.log('DRY RUN: nothing will be uploaded or updated');

  for (const [bucket, config] of Object.entries(BUCKETS)) {
    console.log(`\nMigrating ${bucket} -> ${config.r2Bucket}...`);
    const copyFailures = await copyFiles(bucket, config);
    // Only repoint the DB once every file is safely in R2, so a partial copy
    // never leaves rows pointing at missing objects. Re-run to retry.
    if (copyFailures > 0) {
      console.error(`Skipping URL rewrite for ${bucket}: ${copyFailures} file(s) failed to copy`);
      continue;
    }
    const updateFailures = await rewriteUrls(bucket, config);
    if (updateFailures > 0) console.error(`${updateFailures} row(s) failed to update in ${config.table}`);
  }

  console.log('\nMigration finished.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
