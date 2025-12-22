const admin = require('firebase-admin');

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = admin.firestore();

async function main() {
  console.log('Recent Render Batches:');
  console.log('='.repeat(80));

  const batches = await db.collection('renderBatches')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  if (batches.empty) {
    console.log('No batches found');
    return;
  }

  for (const doc of batches.docs) {
    const data = doc.data();
    console.log('Batch:', doc.id.slice(0, 20) + '...');
    console.log('  Post:', data.postNumber || 'N/A', '| Status:', data.status || 'unknown');
    console.log('  Progress:', (data.completedJobs || 0) + '/' + (data.totalJobs || 0), 'completed,', data.failedJobs || 0, 'failed');
    console.log('  Created:', data.createdAt?.toDate?.() || data.createdAt);

    // Show failed job errors
    if (data.failedJobs > 0) {
      const failedJobs = await db.collection('renderQueue')
        .where('batchId', '==', doc.id)
        .where('status', '==', 'failed')
        .limit(3)
        .get();

      if (!failedJobs.empty) {
        console.log('  Failed jobs:');
        failedJobs.forEach(jobDoc => {
          const job = jobDoc.data();
          console.log(`    - ${job.businessName}: ${job.lastError || 'No error'}`);
        });
      }
    }
    console.log();
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
