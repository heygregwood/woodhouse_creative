// app/api/cron/process-render-queue/route.ts
// Cron job to process pending render jobs from the queue

import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import {
  getPendingRenderJobs,
  updateRenderJob,
  updateBatchProgress,
} from '@/lib/renderQueue';
import { createRender } from '@/lib/creatomate';
import { Timestamp } from 'firebase-admin/firestore';

const DB_PATH = path.join(process.cwd(), 'data', 'sqlite', 'creative.db');

/**
 * GET /api/cron/process-render-queue
 *
 * Processes pending render jobs from the queue
 * - Takes 10 pending jobs (rate limit safety)
 * - Calls Creatomate API for each
 * - Updates job status to "processing"
 * - Waits 350ms between calls (rate limit: 30 req/10s = ~3 req/sec)
 *
 * This endpoint should be called by Vercel Cron every 1 minute
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

    // Get up to 10 pending jobs
    const pendingJobs = await getPendingRenderJobs(10);

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

        // Get dealer data from SQLite
        const db = new Database(DB_PATH, { readonly: true });
        const dealer = db.prepare(`
          SELECT dealer_no, display_name, creatomate_phone, creatomate_website, creatomate_logo
          FROM dealers
          WHERE dealer_no = ?
        `).get(job.businessId) as {
          dealer_no: string;
          display_name: string;
          creatomate_phone: string;
          creatomate_website: string;
          creatomate_logo: string;
        } | undefined;
        db.close();

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
            businessName: dealer.display_name,
            phone: dealer.creatomate_phone,
            logoUrl: dealer.creatomate_logo,
            website: dealer.creatomate_website,
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

        // Rate limit: Wait 350ms between API calls
        // This gives us ~10 renders/minute, well under the 30 req/10s limit
        if (results.processed < pendingJobs.length) {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
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
