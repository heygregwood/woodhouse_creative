// Quick script to check render queue status in Firestore
import { db } from '../lib/firebase';

async function checkRenderQueue() {
  try {
    // Get pending jobs
    const pendingSnapshot = await db.collection('renderQueue')
      .where('status', '==', 'pending')
      .limit(10)
      .get();

    console.log('\n=== PENDING RENDER JOBS ===');
    console.log(`Total pending: ${pendingSnapshot.size}`);

    if (pendingSnapshot.size > 0) {
      pendingSnapshot.forEach(doc => {
        const job = doc.data();
        console.log(`\nJob ID: ${doc.id}`);
        console.log(`  Business: ${job.businessName} (${job.businessId})`);
        console.log(`  Post: ${job.postNumber}`);
        console.log(`  Template: ${job.templateId}`);
        console.log(`  Created: ${job.createdAt?.toDate()}`);
      });
    }

    // Get recent batches
    const batchesSnapshot = await db.collection('renderBatches')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    console.log('\n=== RECENT RENDER BATCHES ===');
    console.log(`Total recent: ${batchesSnapshot.size}`);

    if (batchesSnapshot.size > 0) {
      batchesSnapshot.forEach(doc => {
        const batch = doc.data();
        console.log(`\nBatch ID: ${doc.id}`);
        console.log(`  Post: ${batch.postNumber}`);
        console.log(`  Status: ${batch.status}`);
        console.log(`  Progress: ${batch.completedJobs}/${batch.totalJobs}`);
        console.log(`  Created: ${batch.createdAt?.toDate()}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error checking render queue:', error);
    process.exit(1);
  }
}

checkRenderQueue();
