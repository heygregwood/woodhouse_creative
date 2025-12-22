// scripts/clear_render_queue.js
// Clears all render jobs and batches from Firestore to start fresh

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

async function clearCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();

  if (snapshot.empty) {
    console.log(`${collectionName}: already empty`);
    return 0;
  }

  let batch = db.batch();
  let count = 0;
  let batchCount = 0;

  // Firestore batches limited to 500 operations
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;
    batchCount++;

    if (batchCount === 500) {
      await batch.commit();
      console.log(`${collectionName}: deleted ${count} documents...`);
      batch = db.batch(); // Create new batch
      batchCount = 0;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`${collectionName}: deleted ${count} total documents`);
  return count;
}

async function main() {
  console.log('Clearing Firestore render collections...\n');

  const jobsDeleted = await clearCollection('renderQueue');
  const batchesDeleted = await clearCollection('renderBatches');

  console.log('\n--- Summary ---');
  console.log(`Render jobs deleted: ${jobsDeleted}`);
  console.log(`Render batches deleted: ${batchesDeleted}`);
  console.log('\nYou can now resubmit your batches.');
}

main().catch(console.error);
