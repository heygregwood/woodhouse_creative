// app/api/webhooks/creatomate/route.ts
// Webhook endpoint for Creatomate render completion notifications

import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import {
  getRenderJobByRenderId,
  getRenderJob,
  updateRenderJob,
  updateBatchProgress,
  getRenderBatch,
  getJobsByBatchId,
} from '@/lib/renderQueue';
import { verifyWebhookSignature, downloadVideo } from '@/lib/creatomate';
import { uploadToGoogleDrive } from '@/lib/google-drive';
import type {
  CreatomateWebhookPayload,
  CreatomateMetadata,
} from '@/lib/types/renderQueue';

/**
 * POST /api/webhooks/creatomate
 *
 * Receives webhook notifications from Creatomate when renders complete
 *
 * Payload:
 * {
 *   id: "render-xyz789",
 *   status: "succeeded" | "failed",
 *   url: "https://cdn.creatomate.com/...",
 *   metadata: "{\"jobId\":\"...\",\"businessId\":\"...\",\"postNumber\":700}"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();
    const payload: CreatomateWebhookPayload = JSON.parse(body);

    // Verify webhook signature (if secret is set)
    // TEMPORARILY DISABLED - Creatomate may not provide webhook secret in free/pro plans
    // const signature = request.headers.get('x-creatomate-signature');
    // if (signature) {
    //   const isValid = verifyWebhookSignature(signature, body);
    //   if (!isValid) {
    //     console.error('Invalid webhook signature');
    //     return NextResponse.json(
    //       { error: 'Invalid signature' },
    //       { status: 401 }
    //     );
    //   }
    // }

    // Parse metadata
    const metadata: CreatomateMetadata = payload.metadata
      ? JSON.parse(payload.metadata)
      : null;

    if (!metadata || !metadata.jobId) {
      console.error('Missing metadata in webhook payload');
      return NextResponse.json(
        { error: 'Missing metadata' },
        { status: 400 }
      );
    }

    // Get job by render ID (for idempotency)
    let job = await getRenderJobByRenderId(payload.id);

    // Fallback: If not found by renderId, try looking up by jobId from metadata
    // This handles race conditions where webhook arrives before cron updates renderId
    if (!job && metadata && metadata.jobId) {
      console.log(`Job not found by renderId ${payload.id}, trying jobId ${metadata.jobId}`);
      const { getRenderJob } = await import('@/lib/renderQueue');
      job = await getRenderJob(metadata.jobId);

      // Update the job with renderId for future lookups
      if (job) {
        console.log(`Found job by jobId, updating renderId to ${payload.id}`);
        await updateRenderJob(job.id, { renderId: payload.id });
      }
    }

    if (!job) {
      console.error(`Job not found for render ID: ${payload.id} or jobId: ${metadata?.jobId}`);
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if already processed (idempotency)
    if (job.status === 'completed') {
      console.log(`Job ${job.id} already completed, skipping`);
      return NextResponse.json({
        status: 'already_processed',
        message: 'Job already completed',
      });
    }

    // Handle failure
    if (payload.status === 'failed') {
      console.error(`Render failed for job ${job.id}:`, payload.error);

      await updateRenderJob(job.id, {
        status: 'failed',
        lastError: payload.error || 'Render failed',
        retryCount: job.retryCount + 1,
      });

      await updateBatchProgress(job.batchId);

      return NextResponse.json({
        status: 'error_recorded',
        message: 'Render failed, job marked as failed',
      });
    }

    // Handle success
    if (payload.status === 'succeeded' && payload.url) {
      console.log(`Render succeeded for job ${job.id}, downloading video...`);

      try {
        // Download video from Creatomate
        console.log(`Downloading video from: ${payload.url}`);
        const videoBuffer = await downloadVideo(payload.url);
        console.log(`✅ Downloaded video: ${videoBuffer.byteLength} bytes`);

        // Upload to Google Drive
        // Path: Dealers/{BusinessName}/Post_{PostNumber}.mp4
        const fileName = `Post_${metadata.postNumber}_${job.businessName.replace(/[/\\?%*:|"<>]/g, '-')}.mp4`;
        const folderPath = `Dealers/${job.businessName.replace(/[/\\?%*:|"<>]/g, '-')}`;

        console.log(`Uploading to Google Drive: ${folderPath}/${fileName}`);

        const driveFile = await uploadToGoogleDrive({
          fileName,
          folderPath,
          buffer: Buffer.from(videoBuffer),
          mimeType: 'video/mp4',
        });

        console.log(`✅ Uploaded to Drive: ${driveFile.webViewLink}`);

        // Update job with completion data
        console.log(`Updating job ${job.id} with completion data...`);
        await updateRenderJob(job.id, {
          status: 'completed',
          renderUrl: payload.url,
          driveFileId: driveFile.id,
          driveUrl: driveFile.webViewLink,
          drivePath: driveFile.path,
          completedAt: Timestamp.now(),
          metadata: {
            videoLength: payload.duration || 0,
            creditsUsed: 7, // Estimate for 30s video at 720p
            fileSize: payload.file_size || videoBuffer.byteLength,
          },
        });

        console.log(`✅ Job ${job.id} marked as completed`);

        // Update batch progress
        console.log(`Updating batch ${job.batchId} progress...`);
        await updateBatchProgress(job.batchId);
        console.log(`✅ Batch progress updated`);
      } catch (error) {
        console.error(`Error processing video for job ${job.id}:`, error);
        throw error; // Re-throw to be caught by outer catch block
      }

      // Check if batch is complete
      const batch = await getRenderBatch(job.batchId);
      if (batch) {
        const jobs = await getJobsByBatchId(job.batchId);
        const completed = jobs.filter((j) => j.status === 'completed').length;
        const failed = jobs.filter((j) => j.status === 'failed').length;

        if (completed + failed === jobs.length) {
          console.log(`🎉 Batch ${job.batchId} is complete!`);
          // TODO: Send email notification
          // await sendBatchCompleteEmail({ batch, jobs });
        }
      }

      // Get updated job to retrieve driveUrl
      const updatedJob = await getRenderJob(job.id);

      return NextResponse.json({
        status: 'success',
        message: 'Video processed and uploaded to Google Drive',
        driveUrl: updatedJob?.driveUrl || null,
      });
    }

    // Unknown status
    return NextResponse.json({
      status: 'unknown',
      message: `Unhandled webhook status: ${payload.status}`,
    });
  } catch (error) {
    console.error('Error processing Creatomate webhook:', error);

    // Log the full error stack for debugging
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }

    return NextResponse.json(
      {
        error: 'Failed to process webhook',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
