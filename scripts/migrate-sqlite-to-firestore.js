#!/usr/bin/env node
/**
 * Migrate SQLite dealers to Firestore
 *
 * One-time migration script to copy all dealer data from SQLite to Firestore.
 * Run this locally BEFORE deploying routes that use Firestore.
 *
 * Usage:
 *   node scripts/migrate-sqlite-to-firestore.js --dry-run
 *   node scripts/migrate-sqlite-to-firestore.js --apply
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const Database = require('better-sqlite3');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const DB_PATH = path.join(__dirname, '..', 'data', 'sqlite', 'creative.db');

async function migrateSqliteToFirestore(apply = false) {
  console.log('====================================');
  console.log('SQLite → Firestore Migration');
  console.log('====================================\n');

  if (!apply) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('⚠️  APPLY MODE - Data will be written to Firestore\n');
  }

  // Initialize Firebase
  const app = initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });

  const db = getFirestore(app, 'woodhouse-creative-db');

  // Read all dealers from SQLite
  console.log('📖 Reading dealers from SQLite...');
  const sqlite = new Database(DB_PATH, { readonly: true });

  const dealers = sqlite.prepare('SELECT * FROM dealers').all();
  sqlite.close();

  console.log(`   Found ${dealers.length} dealers in SQLite\n`);

  // Convert SQLite dealers to Firestore format
  const now = new Date().toISOString();
  const firestoreDealers = dealers.map(d => ({
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
    created_at: d.created_at || now,
    updated_at: d.updated_at || now,
  }));

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
    const batchDealers = firestoreDealers.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}: Writing ${batchDealers.length} dealers...`);

    for (const dealer of batchDealers) {
      const docRef = db.collection('dealers').doc(dealer.dealer_no);
      batch.set(docRef, dealer);
    }

    await batch.commit();
    totalMigrated += batchDealers.length;
    console.log(`   ✅ Batch complete (${totalMigrated}/${firestoreDealers.length})`);
  }

  // Verify migration
  console.log('\n🔍 Verifying migration...\n');

  const sampleDealers = firestoreDealers.slice(0, 10);
  let verifiedCount = 0;

  for (const dealer of sampleDealers) {
    const doc = await db.collection('dealers').doc(dealer.dealer_no).get();
    if (doc.exists && doc.data().dealer_name === dealer.dealer_name) {
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
  console.log('  node scripts/migrate-sqlite-to-firestore.js --dry-run');
  console.log('  node scripts/migrate-sqlite-to-firestore.js --apply');
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
