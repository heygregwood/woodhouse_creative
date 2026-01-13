// app/api/creative/render-batch/route.ts
// API endpoint to start batch renders for all FULL dealers from Firestore
// NOTE: Migrated from SQLite to Firestore Jan 2026

import { NextRequest, NextResponse } from 'next/server';
import {
  createRenderBatch,
  createRenderJob,
  isBatchProcessing,
} from '@/lib/renderQueue';
import { getDealers } from '@/lib/firestore-dealers';

interface RenderRequest {
  postNumber: number;
  templateId: string;
  dealerNo?: string;  // Optional: filter to single dealer
}

interface Dealer {
  dealer_no: string;
  display_name: string;
  creatomate_phone: string;
  creatomate_website: string;
  creatomate_logo: string;
}

/**
 * POST /api/creative/render-batch
 *
 * Start batch renders for all FULL dealers from SQLite
 *
 * Request body (single):
 * {
 *   postNumber: 700,
 *   templateId: "603f269d-8019-40b9-8cc5-b4e1829b05bd"
 * }
 *
 * Request body (multiple):
 * {
 *   batches: [
 *     { postNumber: 666, templateId: "abc123" },
 *     { postNumber: 667, templateId: "def456" },
 *     { postNumber: 668, templateId: "ghi789" }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Support both single and multiple batch formats
    let renderRequests: RenderRequest[] = [];

    if (body.batches && Array.isArray(body.batches)) {
      // Multiple batches format
      renderRequests = body.batches;
    } else if (body.postNumber && body.templateId) {
      // Single batch format (backwards compatible)
      renderRequests = [{ postNumber: body.postNumber, templateId: body.templateId }];
    } else {
      return NextResponse.json(
        { error: 'Missing required fields: postNumber and templateId, or batches array' },
        { status: 400 }
      );
    }

    // Validate all requests
    for (const req of renderRequests) {
      if (!req.postNumber || !req.templateId) {
        return NextResponse.json(
          { error: `Invalid batch: missing postNumber or templateId` },
          { status: 400 }
        );
      }
    }

    // Get FULL dealers from Firestore with complete creatomate data
    // If any request has a dealerNo filter, collect all unique dealer numbers
    const dealerNoFilter = new Set<string>();
    for (const req of renderRequests) {
      if (req.dealerNo) {
        dealerNoFilter.add(req.dealerNo);
      }
    }

    // Get all dealers from Firestore and filter
    const allDealers = await getDealers();

    let dealers = allDealers.filter(d =>
      d.program_status === 'FULL' &&
      d.ready_for_automate === 'yes' &&
      d.creatomate_logo &&
      d.creatomate_logo !== '' &&
      d.display_name &&
      d.display_name !== ''
    ).map(d => ({
      dealer_no: d.dealer_no,
      display_name: d.display_name || '',
      creatomate_phone: d.creatomate_phone || '',
      creatomate_website: d.creatomate_website || '',
      creatomate_logo: d.creatomate_logo || '',
    })) as Dealer[];

    // If specific dealers requested, filter to those
    if (dealerNoFilter.size > 0) {
      dealers = dealers.filter(d => dealerNoFilter.has(d.dealer_no));
    }

    if (dealers.length === 0) {
      return NextResponse.json(
        { error: 'No FULL dealers with complete data found' },
        { status: 400 }
      );
    }

    console.log(`Found ${dealers.length} FULL dealers ready for rendering`);

    // Process each batch request
    const results: Array<{
      postNumber: number;
      templateId: string;
      batchId: string;
      jobsCreated: number;
      status: string;
    }> = [];

    for (const req of renderRequests) {
      // Check if batch already processing
      const alreadyProcessing = await isBatchProcessing(req.postNumber);
      if (alreadyProcessing) {
        results.push({
          postNumber: req.postNumber,
          templateId: req.templateId,
          batchId: '',
          jobsCreated: 0,
          status: `Skipped: Post ${req.postNumber} already processing`,
        });
        continue;
      }

      // Create render batch in Firestore
      const batchId = await createRenderBatch({
        postNumber: req.postNumber,
        templateId: req.templateId,
        totalJobs: dealers.length,
        createdBy: 'greg@woodhouseagency.com',
      });

      // Create render jobs for each dealer
      for (const dealer of dealers) {
        await createRenderJob({
          batchId,
          businessId: dealer.dealer_no,
          businessName: dealer.display_name,
          postNumber: req.postNumber,
          templateId: req.templateId,
        });
      }

      results.push({
        postNumber: req.postNumber,
        templateId: req.templateId,
        batchId,
        jobsCreated: dealers.length,
        status: 'queued',
      });

      console.log(`Created batch ${batchId} for Post ${req.postNumber} with ${dealers.length} jobs`);
    }

    // Calculate estimates
    const totalJobs = results.reduce((sum, r) => sum + r.jobsCreated, 0);
    const estimatedMinutes = Math.ceil(totalJobs / 10) + 15;
    const estimatedCompletionTime = new Date(
      Date.now() + estimatedMinutes * 60 * 1000
    ).toISOString();

    return NextResponse.json({
      status: 'success',
      message: `${results.length} batch(es) queued with ${totalJobs} total jobs`,
      dealerCount: dealers.length,
      batches: results,
      estimatedCompletionTime,
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
