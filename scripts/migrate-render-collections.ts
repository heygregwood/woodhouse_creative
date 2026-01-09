#!/usr/bin/env ts-node
/**
 * Migrate renderQueue and renderBatches collections
 * From: (default) database
 * To: woodhouse-creative-db database
 *
 * Run AFTER creating woodhouse-creative-db in Firebase Console
 *
 * Usage:
 *   npx ts-node scripts/migrate-render-collections.ts --dry-run
 *   npx ts-node scripts/migrate-render-collections.ts --apply
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(process.cwd(), '.env.local') });

async function migrateRenderCollections(apply: boolean = false) {
  console.log('====================================');
  console.log('Render Collections Migration');
  console.log('(default) → woodhouse-creative-db');
  console.log('====================================\n');

  if (!apply) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('⚠️  APPLY MODE - Data will be migrated\n');
  }

  // Initialize Firebase
  const app = initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });

  const defaultDb = getFirestore(app); // (default) database
  const creativeDb = getFirestore(app, 'woodhouse-creative-db'); // new database

  const collections = ['renderQueue', 'renderBatches'];

  for (const collectionName of collections) {
    console.log(`\n📦 Processing collection: ${collectionName}`);

    // Read from default database
    const snapshot = await defaultDb.collection(collectionName).get();
    console.log(`   Found ${snapshot.size} documents in (default)/${collectionName}`);

    if (snapshot.empty) {
      console.log(`   ⚠️  Collection is empty, skipping...`);
      continue;
    }

    if (!apply) {
      console.log(`   [DRY RUN] Would migrate ${snapshot.size} documents`);
      // Show sample
      const firstDoc = snapshot.docs[0];
      console.log(`   Sample document ID: ${firstDoc.id}`);
      console.log(`   Sample data keys: ${Object.keys(firstDoc.data()).join(', ')}`);
      continue;
    }

    // Apply mode - migrate documents
    console.log(`   ✍️  Migrating ${snapshot.size} documents...`);

    const batch = creativeDb.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;

    for (const doc of snapshot.docs) {
      const docRef = creativeDb.collection(collectionName).doc(doc.id);
      batch.set(docRef, doc.data());
      batchCount++;

      // Commit batch every 500 docs (Firestore limit)
      if (batchCount === BATCH_SIZE) {
        await batch.commit();
        console.log(`     Committed batch of ${batchCount} documents`);
        batchCount = 0;
      }
    }

    // Commit remaining documents
    if (batchCount > 0) {
      await batch.commit();
      console.log(`     Committed final batch of ${batchCount} documents`);
    }

    console.log(`   ✅ Migrated ${snapshot.size} documents to woodhouse-creative-db/${collectionName}`);
  }

  // Verify migration
  if (apply) {
    console.log('\n🔍 Verifying migration...\n');

    for (const collectionName of collections) {
      const defaultCount = (await defaultDb.collection(collectionName).count().get()).data().count;
      const creativeCount = (await creativeDb.collection(collectionName).count().get()).data().count;

      console.log(`   ${collectionName}:`);
      console.log(`     (default): ${defaultCount} docs`);
      console.log(`     woodhouse-creative-db: ${creativeCount} docs`);

      if (defaultCount === creativeCount) {
        console.log(`     ✅ Counts match!`);
      } else {
        console.log(`     ⚠️  Count mismatch!`);
      }
    }
  }

  console.log('\n====================================');
  console.log('Migration Complete!');
  console.log('====================================\n');

  if (apply) {
    console.log('⚠️  IMPORTANT: After verifying the migration worked:');
    console.log('   1. Test woodhouse_creative app with new database');
    console.log('   2. Delete renderQueue and renderBatches from (default) database');
    console.log('   3. This keeps woodhouse_social SaaS clean\n');
  }

  process.exit(0);
}

// CLI
const args = process.argv.slice(2);
const apply = args.includes('--apply');

if (!apply && !args.includes('--dry-run')) {
  console.log('Usage:');
  console.log('  npx ts-node scripts/migrate-render-collections.ts --dry-run');
  console.log('  npx ts-node scripts/migrate-render-collections.ts --apply');
  process.exit(1);
}

migrateRenderCollections(apply).catch((error) => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
