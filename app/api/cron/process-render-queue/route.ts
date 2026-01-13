// app/api/cron/process-render-queue/route.ts
// Cron job to process pending render jobs from the queue
// NOTE: Migrated from SQLite to Firestore Jan 2026

import { NextRequest, NextResponse } from 'next/server';
import {
  getPendingRenderJobs,
  updateRenderJob,
  updateBatchProgress,
} from '@/lib/renderQueue';
import { createRender } from '@/lib/creatomate';
import { getDealer } from '@/lib/firestore-dealers';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * GET /api/cron/process-render-queue
 *
 * Processes pending render jobs from the queue
 * - Takes 25 pending jobs per run (Creatomate allows 30 req/10s)
 * - Calls Creatomate API for each with minimal delay
 * - Updates job status to "processing"
 *
 * Rate limit math: 30 req/10s = 180/min. We do 25/min to stay safe.
 * This endpoint is called by Vercel Cron every 1 minute.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron request (Vercel adds this header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // In production, verify cron secret
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const startTime = Date.now();
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Get up to 25 pending jobs (safe margin under 30 req/10s limit)
    const pendingJobs = await getPendingRenderJobs(25);

    if (pendingJobs.length === 0) {
      return NextResponse.json({
        message: 'No pending jobs in queue',
        results,
        duration: Date.now() - startTime,
      });
    }

    console.log(`Processing ${pendingJobs.length} pending render jobs...`);

    // Get webhook URL - use env var or fallback to this domain
    const baseUrl = process.env.WEBHOOK_BASE_URL || 'https://woodhouse-creative.vercel.app';
    const webhookUrl = `${baseUrl}/api/webhooks/creatomate`;

    // Process each job
    for (const job of pendingJobs) {
      try {
        results.processed++;

        // Get dealer data from Firestore
        const dealer = await getDealer(job.businessId);

        if (!dealer) {
          throw new Error(`Dealer not found: ${job.businessId}`);
        }

        // Validate required fields
        if (!dealer.display_name || !dealer.creatomate_phone || !dealer.creatomate_logo) {
          throw new Error(
            `Dealer ${job.businessId} missing required fields (name: ${dealer.display_name}, phone: ${dealer.creatomate_phone}, logo: ${!!dealer.creatomate_logo})`
          );
        }

        // Update job to processing
        await updateRenderJob(job.id, {
          status: 'processing',
          processingStartedAt: Timestamp.now(),
        });

        // Call Creatomate API
        const { renderId, status } = await createRender({
          templateId: job.templateId,
          businessData: {
            businessName: dealer.display_name!,
            phone: dealer.creatomate_phone!,
            logoUrl: dealer.creatomate_logo!,
            website: dealer.creatomate_website || undefined,
          },
          metadata: {
            jobId: job.id,
            businessId: job.businessId,
            postNumber: job.postNumber,
          },
          webhookUrl,
        });

        // Update job with render ID
        await updateRenderJob(job.id, {
          renderId,
        });

        // Update batch progress
        await updateBatchProgress(job.batchId);

        results.succeeded++;
        console.log(`✅ Started render for ${dealer.display_name} (renderId: ${renderId})`);
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Job ${job.id}: ${errorMessage}`);

        console.error(`❌ Failed to process job ${job.id}:`, error);

        // Update job with error
        await updateRenderJob(job.id, {
          status: 'pending', // Keep as pending to retry later
          retryCount: job.retryCount + 1,
          lastError: errorMessage,
        });

        // If retry count exceeds 3, mark as failed
        if (job.retryCount >= 3) {
          await updateRenderJob(job.id, {
            status: 'failed',
          });
          await updateBatchProgress(job.batchId);
        }
      }
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      message: `Processed ${results.processed} jobs in ${duration}ms`,
      results,
      duration,
      nextRun: 'In ~1 minute',
    });
  } catch (error) {
    console.error('Error processing render queue:', error);
    return NextResponse.json(
      {
        error: 'Failed to process render queue',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
