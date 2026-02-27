/**
 * Load prospect dealer data into Firestore.
 *
 * Reads the JSON output from build-prospect-data.py and writes/overwrites
 * documents in the `prospect_dealers` collection.
 *
 * Usage:
 *   cd ~/woodhouse_creative
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/load-prospect-dealers.ts
 *   npx tsx scripts/load-prospect-dealers.ts --dry-run
 *   npx tsx scripts/load-prospect-dealers.ts --input /path/to/custom.json
 */

import { readFileSync } from 'fs';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const COLLECTION = 'prospect_dealers';
const DEFAULT_INPUT = '/tmp/prospect-dealers.json';
const BATCH_SIZE = 400; // Firestore batch limit is 500, leave headroom

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const inputIdx = args.indexOf('--input');
const inputPath = inputIdx >= 0 ? args[inputIdx + 1] : DEFAULT_INPUT;

// Initialize Firebase
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore('woodhouse-creative-db');

interface ProspectDealer {
  dealer_no: string;
  dealer_name: string;
  [key: string]: unknown;
}

async function main() {
  console.log(`[load-prospect-dealers] Reading ${inputPath}...`);

  let dealers: ProspectDealer[];
  try {
    const raw = readFileSync(inputPath, 'utf-8');
    dealers = JSON.parse(raw);
  } catch (error: unknown) {
    console.error(`[load-prospect-dealers] Failed to read input:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }

  console.log(`[load-prospect-dealers] Found ${dealers.length} dealers`);

  if (dryRun) {
    console.log('[load-prospect-dealers] DRY RUN — no Firestore writes');
    const targetable = dealers.filter(d => d.targetable);
    const hot = targetable.filter(d => d.prospect_tier === 'hot');
    const warm = targetable.filter(d => d.prospect_tier === 'warm');
    const cold = targetable.filter(d => d.prospect_tier === 'cold');
    console.log(`  Total: ${dealers.length}`);
    console.log(`  Targetable: ${targetable.length} (hot: ${hot.length}, warm: ${warm.length}, cold: ${cold.length})`);
    console.log(`  Off-limits: ${dealers.length - targetable.length}`);
    console.log(`  Sample:`, JSON.stringify(dealers[0], null, 2).slice(0, 500));
    return;
  }

  // Write in batches
  let written = 0;
  for (let i = 0; i < dealers.length; i += BATCH_SIZE) {
    const chunk = dealers.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const dealer of chunk) {
      if (!dealer.dealer_no) {
        console.warn('[load-prospect-dealers] Skipping dealer with no dealer_no');
        continue;
      }

      const docRef = db.collection(COLLECTION).doc(dealer.dealer_no);

      // Add Firestore timestamps
      const doc = {
        ...dealer,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      };

      batch.set(docRef, doc, { merge: false });
    }

    await batch.commit();
    written += chunk.length;
    console.log(`[load-prospect-dealers] Written ${written}/${dealers.length}`);
  }

  console.log(`[load-prospect-dealers] Done. ${written} documents in '${COLLECTION}'.`);

  // Quick verification
  const snap = await db.collection(COLLECTION).count().get();
  console.log(`[load-prospect-dealers] Collection count: ${snap.data().count}`);
}

main().catch(err => {
  console.error('[load-prospect-dealers] Fatal error:', err);
  process.exit(1);
});
