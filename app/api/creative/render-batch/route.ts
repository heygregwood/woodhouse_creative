// app/api/creative/render-batch/route.ts
// API endpoint to start a batch render for all active dealers

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  createRenderBatch,
  createRenderJob,
  isBatchProcessing,
} from '@/lib/renderQueue';
import type { CreateRenderBatchRequest } from '@/lib/types/renderQueue';

/**
 * POST /api/creative/render-batch
 *
 * Start a batch render for all active dealers
 *
 * Request body:
 * {
 *   postNumber: 700,
 *   templateId: "603f269d-8019-40b9-8cc5-b4e1829b05bd",
 *   baseVideoUrl?: "https://..." (optional)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateRenderBatchRequest = await request.json();
    const { postNumber, templateId, baseVideoUrl } = body;

    // Validate required fields
    if (!postNumber || !templateId) {
      return NextResponse.json(
        { error: 'Missing required fields: postNumber, templateId' },
        { status: 400 }
      );
    }

    // Check if a batch is already processing for this post number
    const alreadyProcessing = await isBatchProcessing(postNumber);
    if (alreadyProcessing) {
      return NextResponse.json(
        {
          error: `Batch for post ${postNumber} is already processing`,
          message: 'Please wait for the current batch to complete',
        },
        { status: 409 }
      );
    }

    // Get all ACTIVE businesses from Firestore
    const businessesSnapshot = await db
      .collection('businesses')
      .where('status', '==', 'ACTIVE')
      .get();

    if (businessesSnapshot.empty) {
      return NextResponse.json(
        { error: 'No active businesses found' },
        { status: 400 }
      );
    }

    const businesses = businessesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as { businessName?: string; phone?: string; logoUrl?: string }),
    }));

    // Validate that all businesses have required fields
    const validBusinesses = businesses.filter((b: any) => {
      const hasRequired = b.businessName && b.phone && b.logoUrl;
      if (!hasRequired) {
        console.warn(
          `Skipping business ${b.id}: missing required fields (name: ${b.businessName}, phone: ${b.phone}, logo: ${!!b.logoUrl})`
        );
      }
      return hasRequired;
    });

    if (validBusinesses.length === 0) {
      return NextResponse.json(
        {
          error: 'No businesses with complete data found',
          message: 'All businesses are missing required fields (name, phone, or logo)',
        },
        { status: 400 }
      );
    }

    // Create render batch
    const batchId = await createRenderBatch({
      postNumber,
      templateId,
      totalJobs: validBusinesses.length,
      createdBy: 'greg@woodhouseagency.com', // TODO: Get from auth when implemented
      baseVideoUrl,
    });

    // Create render jobs for each business
    const jobIds: string[] = [];
    for (const business of validBusinesses) {
      const jobId = await createRenderJob({
        batchId,
        businessId: business.id,
        businessName: business.businessName!, // Safe: filtered above
        postNumber,
        templateId,
      });
      jobIds.push(jobId);
    }

    // Estimate completion time
    // With 10 renders/minute and ~2-5 min render time, estimate 15-20 minutes total
    const estimatedMinutes = Math.ceil(validBusinesses.length / 10) + 15;
    const estimatedCompletionTime = new Date(
      Date.now() + estimatedMinutes * 60 * 1000
    ).toISOString();

    return NextResponse.json({
      status: 'success',
      batchId,
      jobsCreated: validBusinesses.length,
      skippedBusinesses: businesses.length - validBusinesses.length,
      estimatedCompletionTime,
      message: `Batch queued successfully. ${validBusinesses.length} videos will be rendered. You'll receive an email when complete.`,
      details: {
        postNumber,
        templateId,
        totalBusinesses: businesses.length,
        validBusinesses: validBusinesses.length,
      },
    });
  } catch (error) {
    console.error('Error creating render batch:', error);
    return NextResponse.json(
      {
        error: 'Failed to create render batch',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/creative/render-batch?batchId={batchId}
 *
 * Get status of a render batch
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      return NextResponse.json(
        { error: 'Missing batchId parameter' },
        { status: 400 }
      );
    }

    // Import getBatchStats here to avoid circular dependency
    const { getBatchStats, getRenderBatch } = await import('@/lib/renderQueue');

    const batch = await getRenderBatch(batchId);
    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    const stats = await getBatchStats(batchId);

    // Estimate time remaining
    const remainingJobs = stats.pending + stats.processing;
    const estimatedMinutesRemaining = Math.ceil(remainingJobs / 10) + 5;
    const estimatedTimeRemaining = `${estimatedMinutesRemaining} minutes`;

    return NextResponse.json({
      batchId: batch.id,
      postNumber: batch.postNumber,
      status: batch.status,
      progress: {
        total: stats.total,
        completed: stats.completed,
        failed: stats.failed,
        pending: stats.pending,
        processing: stats.processing,
        percentComplete: stats.percentComplete,
      },
      estimatedTimeRemaining,
      recentCompletions: stats.recentCompletions,
      failures: stats.failures,
      createdAt: batch.createdAt.toDate().toISOString(),
      completedAt: batch.completedAt?.toDate().toISOString() || null,
    });
  } catch (error) {
    console.error('Error getting batch status:', error);
    return NextResponse.json(
      {
        error: 'Failed to get batch status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
