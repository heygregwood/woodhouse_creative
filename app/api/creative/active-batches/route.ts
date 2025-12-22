// app/api/creative/active-batches/route.ts
// Get all active (non-completed) render batches

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

/**
 * GET /api/creative/active-batches
 *
 * Returns all batches that are not yet completed (queued or processing)
 */
export async function GET(request: NextRequest) {
  try {
    // Get batches that are queued or processing
    const snapshot = await db.collection('renderBatches')
      .where('status', 'in', ['queued', 'processing'])
      .orderBy('createdAt', 'desc')
      .get();

    if (snapshot.empty) {
      return NextResponse.json({
        batches: [],
        message: 'No active batches',
      });
    }

    const batches = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        batchId: doc.id,
        postNumber: data.postNumber,
        status: data.status,
        totalJobs: data.totalJobs,
        completedJobs: data.completedJobs,
        failedJobs: data.failedJobs,
        pendingJobs: data.pendingJobs,
        processingJobs: data.processingJobs,
        createdAt: data.createdAt?.toDate().toISOString(),
      };
    });

    return NextResponse.json({
      batches,
      count: batches.length,
    });
  } catch (error) {
    console.error('Error fetching active batches:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch active batches',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
