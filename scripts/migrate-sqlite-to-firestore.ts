#!/usr/bin/env ts-node
/**
 * Migrate SQLite dealers to Firestore
 *
 * One-time migration script to copy all dealer data from SQLite to Firestore.
 * Run this locally BEFORE deploying routes that use Firestore.
 *
 * Usage:
 *   npx ts-node scripts/migrate-sqlite-to-firestore.ts --dry-run
 *   npx ts-node scripts/migrate-sqlite-to-firestore.ts --apply
 */

import Database from 'better-sqlite3';
import path from 'path';
import { config } from 'dotenv';
import { batchCreateDealers, getDealer } from '../lib/firestore-dealers';
import type { FirestoreDealer } from '../lib/firestore-dealers';

// Load environment variables
config({ path: path.join(process.cwd(), '.env.local') });

const DB_PATH = path.join(process.cwd(), 'data', 'sqlite', 'creative.db');

interface SqliteDealer {
  dealer_no: string;
  dealer_name: string;
  display_name?: string | null;
  program_status: string;
  source: string;
  contact_name?: string | null;
  contact_first_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_admin_email?: string | null;
  first_post_date?: string | null;
  date_added?: string | null;
  registration_date?: string | null;
  renew_date?: string | null;
  dealer_address?: string | null;
  dealer_city?: string | null;
  dealer_state?: string | null;
  dealer_web_address?: string | null;
  region?: string | null;
  distributor_name?: string | null;
  allied_status?: string | null;
  armstrong_air: number;
  airease: number;
  tier?: string | null;
  creatomate_phone?: string | null;
  creatomate_website?: string | null;
  creatomate_logo?: string | null;
  turnkey_phone?: string | null;
  turnkey_url?: string | null;
  turnkey_email?: string | null;
  has_sprout_excel: number;
  bad_email: number;
  ready_for_automate?: string | null;
  logo_needs_design?: number | null;
  review_status?: string | null;
  facebook_page_id?: string | null;
  first_post_email_sent?: string | null;
  last_post_email_sent?: string | null;
  note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

async function migrateSqliteToFirestore(apply: boolean = false) {
  console.log('====================================');
  console.log('SQLite → Firestore Migration');
  console.log('====================================\n');

  if (!apply) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('⚠️  APPLY MODE - Data will be written to Firestore\n');
  }

  // Read all dealers from SQLite
  console.log('📖 Reading dealers from SQLite...');
  const db = new Database(DB_PATH, { readonly: true });

  const dealers = db.prepare('SELECT * FROM dealers').all() as SqliteDealer[];
  db.close();

  console.log(`   Found ${dealers.length} dealers in SQLite\n`);

  // Convert SQLite dealers to Firestore format
  const firestoreDealers: Omit<FirestoreDealer, 'created_at' | 'updated_at'>[] = dealers.map(d => {
    const now = new Date().toISOString();
    return {
      dealer_no: d.dealer_no,
      dealer_name: d.dealer_name,
      display_name: d.display_name || null,
      program_status: d.program_status,
      source: d.source,
      contact_name: d.contact_name || null,
      contact_first_name: d.contact_first_name || null,
      contact_email: d.contact_email || null,
      contact_phone: d.contact_phone || null,
      contact_admin_email: d.contact_admin_email || null,
      first_post_date: d.first_post_date || null,
      date_added: d.date_added || null,
      registration_date: d.registration_date || null,
      renew_date: d.renew_date || null,
      dealer_address: d.dealer_address || null,
      dealer_city: d.dealer_city || null,
      dealer_state: d.dealer_state || null,
      dealer_web_address: d.dealer_web_address || null,
      region: d.region || null,
      distributor_name: d.distributor_name || null,
      allied_status: d.allied_status || null,
      armstrong_air: d.armstrong_air,
      airease: d.airease,
      tier: d.tier || null,
      creatomate_phone: d.creatomate_phone || null,
      creatomate_website: d.creatomate_website || null,
      creatomate_logo: d.creatomate_logo || null,
      turnkey_phone: d.turnkey_phone || null,
      turnkey_url: d.turnkey_url || null,
      turnkey_email: d.turnkey_email || null,
      has_sprout_excel: d.has_sprout_excel,
      bad_email: d.bad_email,
      ready_for_automate: d.ready_for_automate || null,
      logo_needs_design: d.logo_needs_design || null,
      review_status: d.review_status || null,
      facebook_page_id: d.facebook_page_id || null,
      first_post_email_sent: d.first_post_email_sent || null,
      last_post_email_sent: d.last_post_email_sent || null,
      note: d.note || null,
    };
  });

  if (!apply) {
    console.log('📊 Preview of first 5 dealers:\n');
    firestoreDealers.slice(0, 5).forEach(d => {
      console.log(`   ${d.dealer_no} - ${d.display_name || d.dealer_name} (${d.program_status})`);
    });
    console.log('\n✅ Dry run complete. Run with --apply to migrate data.\n');
    return;
  }

  // Write to Firestore in batches of 500 (Firestore batch limit)
  console.log('📝 Writing to Firestore...\n');

  const BATCH_SIZE = 500;
  let totalMigrated = 0;

  for (let i = 0; i < firestoreDealers.length; i += BATCH_SIZE) {
    const batch = firestoreDealers.slice(i, i + BATCH_SIZE);

    console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}: Writing ${batch.length} dealers...`);

    try {
      await batchCreateDealers(batch);
      totalMigrated += batch.length;
      console.log(`   ✅ Batch complete (${totalMigrated}/${firestoreDealers.length})`);
    } catch (error: unknown) {
      console.error(`   ❌ Error writing batch:`, error);
      throw error;
    }
  }

  // Verify migration
  console.log('\n🔍 Verifying migration...\n');

  const sampleDealers = firestoreDealers.slice(0, 10);
  let verifiedCount = 0;

  for (const dealer of sampleDealers) {
    const firestoreDealer = await getDealer(dealer.dealer_no);
    if (firestoreDealer && firestoreDealer.dealer_name === dealer.dealer_name) {
      verifiedCount++;
    } else {
      console.log(`   ⚠️  Verification failed for dealer ${dealer.dealer_no}`);
    }
  }

  console.log(`   Verified ${verifiedCount}/${sampleDealers.length} sample dealers\n`);

  console.log('====================================');
  console.log(`✅ Migration Complete!`);
  console.log(`   Total dealers migrated: ${totalMigrated}`);
  console.log('====================================\n');
}

// CLI
const args = process.argv.slice(2);
const apply = args.includes('--apply');

if (!apply && !args.includes('--dry-run')) {
  console.log('Usage:');
  console.log('  npx ts-node scripts/migrate-sqlite-to-firestore.ts --dry-run');
  console.log('  npx ts-node scripts/migrate-sqlite-to-firestore.ts --apply');
  process.exit(1);
}

migrateSqliteToFirestore(apply)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
