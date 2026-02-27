/**
 * Load pe_allied_dealers data into Firestore (woodhouse_social default database).
 *
 * Reads the JSON output from build-pe-allied-dealers.py and writes documents
 * to the `pe_allied_dealers` collection in the DEFAULT Firestore database
 * (woodhouse_social's database, NOT woodhouse-creative-db).
 *
 * WARNING: --write mode deletes ALL existing pe_allied_dealers docs first,
 * then writes new data. This is a destructive, irreversible operation.
 *
 * Usage:
 *   cd ~/woodhouse_creative
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/load-pe-allied-dealers.ts --dry-run
 *   npx tsx scripts/load-pe-allied-dealers.ts --write
 */

import { readFileSync } from 'fs';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const COLLECTION = 'pe_allied_dealers';
const DEFAULT_INPUT = '/tmp/pe-allied-dealers.json';
const BATCH_SIZE = 400;

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const writeMode = args.includes('--write');
const inputIdx = args.indexOf('--input');
const inputPath = inputIdx >= 0 ? args[inputIdx + 1] : DEFAULT_INPUT;

if (!dryRun && !writeMode) {
  console.error('[load-pe-allied] ERROR: Must specify --dry-run or --write');
  console.error('  --dry-run  Show summary without making changes');
  console.error('  --write    Delete old collection and write new data (DESTRUCTIVE)');
  process.exit(1);
}

// Initialize Firebase — same project, DEFAULT database (woodhouse_social)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

// DEFAULT database — this is woodhouse_social's Firestore, not woodhouse-creative-db
const db = getFirestore();

interface AlliedDealer {
  dealer_no: string;
  dealer_name: string;
  allied_segment: string;
  suppress_from_outreach: boolean;
  [key: string]: unknown;
}

async function main() {
  console.log(`[load-pe-allied] Reading ${inputPath}...`);

  let dealers: AlliedDealer[];
  try {
    const raw = readFileSync(inputPath, 'utf-8');
    dealers = JSON.parse(raw);
  } catch (error: unknown) {
    console.error(`[load-pe-allied] Failed to read input:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }

  console.log(`[load-pe-allied] Found ${dealers.length.toLocaleString()} dealers in JSON`);

  // Segment summary
  const segments: Record<string, number> = {};
  for (const d of dealers) {
    segments[d.allied_segment] = (segments[d.allied_segment] || 0) + 1;
  }
  console.log(`\n  Segment breakdown:`);
  for (const [seg, count] of Object.entries(segments).sort((a, b) => b[1] - a[1])) {
    const flag = seg === 'current_turnkey' ? ' [SUPPRESS]' : '';
    console.log(`    ${seg}: ${count.toLocaleString()}${flag}`);
  }

  const suppressed = dealers.filter(d => d.suppress_from_outreach).length;
  const withScoring = dealers.filter(d => d.prospect_score !== null).length;
  console.log(`\n  Suppressed: ${suppressed.toLocaleString()}`);
  console.log(`  With scoring: ${withScoring.toLocaleString()}`);

  if (dryRun) {
    console.log('\n[load-pe-allied] DRY RUN — no Firestore changes');

    // Check current collection count
    const snap = await db.collection(COLLECTION).count().get();
    console.log(`  Current ${COLLECTION} count: ${snap.data().count.toLocaleString()}`);
    console.log(`  Would delete all ${snap.data().count.toLocaleString()} existing docs`);
    console.log(`  Would write ${dealers.length.toLocaleString()} new docs (doc ID = dealer_no)`);

    // Sample record
    const sample = dealers.find(d => d.prospect_score !== null) || dealers[0];
    console.log(`\n  Sample enriched record:`);
    console.log(JSON.stringify(sample, null, 2).slice(0, 800));
    return;
  }

  // === WRITE MODE ===
  console.log('\n[load-pe-allied] WRITE MODE — replacing collection...');

  // Step 1: Delete all existing docs
  console.log('[load-pe-allied] Step 1: Deleting existing documents...');
  let deleted = 0;
  let query = db.collection(COLLECTION).limit(BATCH_SIZE);

  while (true) {
    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batch = db.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += snapshot.size;
    console.log(`  Deleted ${deleted.toLocaleString()} docs...`);
  }
  console.log(`[load-pe-allied] Deleted ${deleted.toLocaleString()} existing documents.`);

  // Step 2: Write new docs
  console.log('[load-pe-allied] Step 2: Writing new documents...');
  let written = 0;
  let skipped = 0;

  for (let i = 0; i < dealers.length; i += BATCH_SIZE) {
    const chunk = dealers.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const dealer of chunk) {
      if (!dealer.dealer_no) {
        skipped++;
        continue;
      }

      const docRef = db.collection(COLLECTION).doc(dealer.dealer_no);
      batch.set(docRef, {
        ...dealer,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    written += chunk.length;

    // Progress every 10 batches
    if ((i / BATCH_SIZE) % 10 === 0 || i + BATCH_SIZE >= dealers.length) {
      console.log(`  Written ${written.toLocaleString()}/${dealers.length.toLocaleString()}`);
    }
  }

  if (skipped > 0) {
    console.log(`[load-pe-allied] Skipped ${skipped} dealers with no dealer_no`);
  }
  console.log(`[load-pe-allied] Written ${written.toLocaleString()} documents to '${COLLECTION}'.`);

  // Verification count
  const finalSnap = await db.collection(COLLECTION).count().get();
  console.log(`[load-pe-allied] Final collection count: ${finalSnap.data().count.toLocaleString()}`);
}

main().catch(err => {
  console.error('[load-pe-allied] Fatal error:', err);
  process.exit(1);
});
