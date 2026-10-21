// Read-only report of what's actually stored in R2: per bucket, the file
// count, total size, average, and the largest files — to check uploads are
// the compressed versions (see src/utils/imageCompression.js) rather than
// raw phone photos.
//
// Uses the same gitignored .env as migrate-to-r2.js:
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
//
// Usage:
//   node scripts/r2-size-report.js

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

for (const name of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
  if (!process.env[name]) {
    console.error(`Missing ${name} in .env`);
    process.exit(1);
  }
}

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKETS = ['saveitgolf-posts', 'saveitgolf-avatars', 'saveitgolf-scorecards'];
const TOP_N = 10;

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

async function listAllObjects(bucket) {
  const objects = [];
  let token;
  do {
    const page = await r2Client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    objects.push(...(page.Contents ?? []));
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return objects;
}

function kindOf(key) {
  const ext = key.split('.').pop().toLowerCase();
  return ['mp4', 'mov', 'm4v'].includes(ext) ? 'video' : 'image';
}

async function main() {
  for (const bucket of BUCKETS) {
    const objects = await listAllObjects(bucket);
    console.log(`\n${bucket}: ${objects.length} files`);
    if (!objects.length) continue;

    for (const kind of ['image', 'video']) {
      const group = objects.filter((o) => kindOf(o.Key) === kind);
      if (!group.length) continue;
      const total = group.reduce((sum, o) => sum + o.Size, 0);
      console.log(`  ${kind}s: ${group.length}, total ${formatBytes(total)}, average ${formatBytes(total / group.length)}`);
    }

    console.log(`  largest ${Math.min(TOP_N, objects.length)}:`);
    [...objects]
      .sort((a, b) => b.Size - a.Size)
      .slice(0, TOP_N)
      .forEach((o) => console.log(`    ${formatBytes(o.Size).padStart(10)}  ${o.Key}  (${o.LastModified.toISOString().slice(0, 10)})`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
