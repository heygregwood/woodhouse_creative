/**
 * Apply approved Allied dealer matches to pe_prospects.
 *
 * Reads a CSV of matched dealer_no → prospect_id pairs and updates
 * pe_prospects documents with is_allied = true and allied_dealer_id.
 *
 * Usage:
 *   cd ~/woodhouse_creative
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/apply-allied-matches.ts --dry-run
 *   npx tsx scripts/apply-allied-matches.ts --dry-run --input /tmp/allied-matches-fuzzy-sample.csv
 *   npx tsx scripts/apply-allied-matches.ts --write
 */

import { readFileSync } from 'fs';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const DEFAULT_INPUT = '/tmp/allied-matches-high-confidence.csv';
const BATCH_SIZE = 400;

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const writeMode = args.includes('--write');
const inputIdx = args.indexOf('--input');
const inputPath = inputIdx >= 0 ? args[inputIdx + 1] : DEFAULT_INPUT;

if (!dryRun && !writeMode) {
  console.error('[apply-matches] ERROR: Must specify --dry-run or --write');
  console.error('  --dry-run  Show what would be updated');
  console.error('  --write    Apply updates to Firestore');
  console.error('  --input    Path to matches CSV (default: /tmp/allied-matches-high-confidence.csv)');
  process.exit(1);
}

// Initialize Firebase — DEFAULT database (woodhouse_social)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

interface MatchRow {
  dealer_no: string;
  dealer_name: string;
  allied_segment: string;
  prospect_id: string;
  prospect_title: string;
  match_reason: string;
  matched_value: string;
}

function parseCSV(path: string): MatchRow[] {
  const raw = readFileSync(path, 'utf-8');
  const lines = raw.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const rows: MatchRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle quoted CSV values
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }

    if (row.dealer_no && row.prospect_id) {
      rows.push(row as unknown as MatchRow);
    }
  }

  return rows;
}

async function main() {
  console.log(`[apply-matches] Reading ${inputPath}...`);

  const matches = parseCSV(inputPath);
  console.log(`[apply-matches] Found ${matches.length.toLocaleString()} matches`);

  if (matches.length === 0) {
    console.log('[apply-matches] No matches to apply.');
    return;
  }

  // Summary by match reason
  const byReason: Record<string, number> = {};
  for (const m of matches) {
    byReason[m.match_reason] = (byReason[m.match_reason] || 0) + 1;
  }
  console.log('\n  By match reason:');
  for (const [reason, count] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${reason}: ${count.toLocaleString()}`);
  }

  // Summary by segment
  const bySeg: Record<string, number> = {};
  for (const m of matches) {
    bySeg[m.allied_segment] = (bySeg[m.allied_segment] || 0) + 1;
  }
  console.log('\n  By allied segment:');
  for (const [seg, count] of Object.entries(bySeg).sort((a, b) => b[1] - a[1])) {
    const flag = seg === 'current_turnkey' ? ' [SUPPRESS]' : '';
    console.log(`    ${seg}: ${count.toLocaleString()}${flag}`);
  }

  // Show samples
  console.log('\n  Samples:');
  for (const m of matches.slice(0, 5)) {
    console.log(`    ${m.dealer_no} "${m.dealer_name}" → "${m.prospect_title}" (${m.match_reason}: ${m.matched_value})`);
  }

  // Check for duplicate prospect IDs (one prospect matched to multiple dealers)
  const prospectCounts: Record<string, number> = {};
  for (const m of matches) {
    prospectCounts[m.prospect_id] = (prospectCounts[m.prospect_id] || 0) + 1;
  }
  const dupes = Object.entries(prospectCounts).filter(([, c]) => c > 1);
  if (dupes.length > 0) {
    console.log(`\n  WARNING: ${dupes.length} prospects matched to multiple dealers:`);
    for (const [pid, count] of dupes.slice(0, 5)) {
      const matchedDealers = matches.filter(m => m.prospect_id === pid);
      console.log(`    ${pid}: ${count} dealers (${matchedDealers.map(m => m.dealer_no).join(', ')})`);
    }
    console.log('  Skipping duplicates — only first match per prospect will be applied.');
  }

  // Deduplicate: first match wins per prospect
  const seen = new Set<string>();
  const deduped: MatchRow[] = [];
  for (const m of matches) {
    if (!seen.has(m.prospect_id)) {
      seen.add(m.prospect_id);
      deduped.push(m);
    }
  }

  if (dryRun) {
    console.log(`\n[apply-matches] DRY RUN — would update ${deduped.length.toLocaleString()} prospects`);

    // Verify a few prospects exist
    console.log('\n  Verifying sample prospects exist in Firestore...');
    for (const m of deduped.slice(0, 3)) {
      const doc = await db.collection('pe_prospects').doc(m.prospect_id).get();
      const exists = doc.exists;
      const currentAllied = doc.data()?.is_allied || false;
      console.log(`    ${m.prospect_id}: exists=${exists}, currently is_allied=${currentAllied}`);
    }
    return;
  }

  // === WRITE MODE ===
  console.log(`\n[apply-matches] WRITE MODE — updating ${deduped.length.toLocaleString()} prospects...`);

  let written = 0;
  let errors = 0;

  for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
    const chunk = deduped.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const m of chunk) {
      const ref = db.collection('pe_prospects').doc(m.prospect_id);
      batch.update(ref, {
        is_allied: true,
        allied_dealer_id: m.dealer_no,
        updated_at: FieldValue.serverTimestamp(),
      });
    }

    try {
      await batch.commit();
      written += chunk.length;
      if ((i / BATCH_SIZE) % 5 === 0 || i + BATCH_SIZE >= deduped.length) {
        console.log(`  Updated ${written.toLocaleString()}/${deduped.length.toLocaleString()}`);
      }
    } catch (err: unknown) {
      errors++;
      console.error(`  Batch error at offset ${i}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\n[apply-matches] Done. Updated ${written.toLocaleString()} prospects. Errors: ${errors}`);

  // Verification
  const snap = await db.collection('pe_prospects')
    .where('is_allied', '==', true)
    .count()
    .get();
  console.log(`[apply-matches] Total pe_prospects with is_allied=true: ${snap.data().count.toLocaleString()}`);
}

main().catch(err => {
  console.error('[apply-matches] Fatal error:', err);
  process.exit(1);
});
