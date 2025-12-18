// lib/renderQueue.ts
// Firestore helper functions for Creative Automation - Render Queue

import { db } from './firebase';
import type { RenderQueueJob, RenderBatch } from './types/renderQueue';
import { Timestamp } from 'firebase-admin/firestore';

// Collection references
const RENDER_QUEUE_COLLECTION = 'renderQueue';
const RENDER_BATCHES_COLLECTION = 'renderBatches';

/**
 * Create a new render batch
 */
export async function createRenderBatch({
  postNumber,
  templateId,
  totalJobs,
  createdBy,
  baseVideoUrl,
}: {
  postNumber: number;
  templateId: string;
  totalJobs: number;
  createdBy: string;
  baseVideoUrl?: string;
}): Promise<string> {
  const batchRef = db.collection(RENDER_BATCHES_COLLECTION).doc();

  const batch: any = {
    postNumber,
    templateId,
    totalJobs,
    completedJobs: 0,
    failedJobs: 0,
    pendingJobs: totalJobs,
    processingJobs: 0,
    status: 'queued',
    createdAt: Timestamp.now(),
    startedAt: null,
    completedAt: null,
    createdBy,
    totalCreditsUsed: 0,
    totalFileSize: 0,
    averageRenderTime: 0,
  };

  // Only include baseVideoUrl if it's defined
  if (baseVideoUrl) {
    batch.baseVideoUrl = baseVideoUrl;
  }

  await batchRef.set(batch);

  return batchRef.id;
}

/**
 * Create a render queue job
 */
export async function createRenderJob({
  batchId,
  businessId,
  businessName,
  postNumber,
  templateId,
}: {
  batchId: string;
  businessId: string;
  businessName: string;
  postNumber: number;
  templateId: string;
}): Promise<string> {
  const jobRef = db.collection(RENDER_QUEUE_COLLECTION).doc();

  const job: Omit<RenderQueueJob, 'id'> = {
    batchId,
    businessId,
    businessName,
    postNumber,
    templateId,
    status: 'pending',
    renderId: null,
    renderUrl: null,
    driveFileId: null,
    driveUrl: null,
    drivePath: null,
    createdAt: Timestamp.now(),
    processingStartedAt: null,
    completedAt: null,
    retryCount: 0,
    lastError: null,
    metadata: null,
  };

  await jobRef.set(job);

  return jobRef.id;
}

/**
 * Get render job by ID
 */
export async function getRenderJob(jobId: string): Promise<RenderQueueJob | null> {
  const jobDoc = await db.collection(RENDER_QUEUE_COLLECTION).doc(jobId).get();

  if (!jobDoc.exists) {
    return null;
  }

  return {
    id: jobDoc.id,
    ...jobDoc.data(),
  } as RenderQueueJob;
}

/**
 * Get render job by render ID
 */
export async function getRenderJobByRenderId(renderId: string): Promise<RenderQueueJob | null> {
  const snapshot = await db
    .collection(RENDER_QUEUE_COLLECTION)
    .where('renderId', '==', renderId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as RenderQueueJob;
}

/**
 * Get pending render jobs (for cron processing)
 */
export async function getPendingRenderJobs(limit: number = 10): Promise<RenderQueueJob[]> {
  const snapshot = await db
    .collection(RENDER_QUEUE_COLLECTION)
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'asc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  } as RenderQueueJob));
}

/**
 * Update render job
 */
export async function updateRenderJob(
  jobId: string,
  updates: Partial<Omit<RenderQueueJob, 'id'>>
): Promise<void> {
  await db.collection(RENDER_QUEUE_COLLECTION).doc(jobId).update(updates);
}

/**
 * Get render batch by ID
 */
export async function getRenderBatch(batchId: string): Promise<RenderBatch | null> {
  const batchDoc = await db.collection(RENDER_BATCHES_COLLECTION).doc(batchId).get();

  if (!batchDoc.exists) {
    return null;
  }

  return {
    id: batchDoc.id,
    ...batchDoc.data(),
  } as RenderBatch;
}

/**
 * Get render batch by post number
 */
export async function getRenderBatchByPostNumber(postNumber: number): Promise<RenderBatch | null> {
  const snapshot = await db
    .collection(RENDER_BATCHES_COLLECTION)
    .where('postNumber', '==', postNumber)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as RenderBatch;
}

/**
 * Check if a batch is already processing for this post number
 */
export async function isBatchProcessing(postNumber: number): Promise<boolean> {
  const snapshot = await db
    .collection(RENDER_BATCHES_COLLECTION)
    .where('postNumber', '==', postNumber)
    .where('status', 'in', ['queued', 'processing'])
    .limit(1)
    .get();

  return !snapshot.empty;
}

/**
 * Get all jobs for a batch
 */
export async function getJobsByBatchId(batchId: string): Promise<RenderQueueJob[]> {
  const snapshot = await db
    .collection(RENDER_QUEUE_COLLECTION)
    .where('batchId', '==', batchId)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  } as RenderQueueJob));
}

/**
 * Update batch progress
 * Call this after a job status changes
 */
export async function updateBatchProgress(batchId: string): Promise<void> {
  const jobs = await getJobsByBatchId(batchId);

  const completed = jobs.filter((j) => j.status === 'completed').length;
  const failed = jobs.filter((j) => j.status === 'failed').length;
  const pending = jobs.filter((j) => j.status === 'pending').length;
  const processing = jobs.filter((j) => j.status === 'processing').length;

  // Calculate batch status
  let status: RenderBatch['status'] = 'processing';
  if (completed + failed === jobs.length) {
    if (failed === 0) {
      status = 'completed';
    } else if (completed === 0) {
      status = 'failed';
    } else {
      status = 'partial_failure';
    }
  } else if (pending === jobs.length) {
    status = 'queued';
  }

  // Calculate stats
  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const totalCreditsUsed = completedJobs.reduce((sum, j) => sum + (j.metadata?.creditsUsed || 0), 0);
  const totalFileSize = completedJobs.reduce((sum, j) => sum + (j.metadata?.fileSize || 0), 0);
  const totalRenderTime = completedJobs.reduce((sum, j) => sum + (j.metadata?.videoLength || 0), 0);
  const averageRenderTime = completedJobs.length > 0 ? totalRenderTime / completedJobs.length : 0;

  // Update batch
  const updates: Partial<Omit<RenderBatch, 'id'>> = {
    completedJobs: completed,
    failedJobs: failed,
    pendingJobs: pending,
    processingJobs: processing,
    status,
    totalCreditsUsed,
    totalFileSize,
    averageRenderTime,
  };

  // Set startedAt if transitioning from queued to processing
  if (processing > 0 || completed > 0 || failed > 0) {
    const batch = await getRenderBatch(batchId);
    if (batch && !batch.startedAt) {
      updates.startedAt = Timestamp.now();
    }
  }

  // Set completedAt if batch is done
  if (status === 'completed' || status === 'partial_failure' || status === 'failed') {
    updates.completedAt = Timestamp.now();
  }

  await db.collection(RENDER_BATCHES_COLLECTION).doc(batchId).update(updates);
}

/**
 * Get orphaned jobs (stuck in processing for too long)
 * Used for polling backup when webhooks fail
 */
export async function getOrphanedJobs(minutesOld: number = 15): Promise<RenderQueueJob[]> {
  const cutoffTime = Timestamp.fromMillis(Date.now() - minutesOld * 60 * 1000);

  const snapshot = await db
    .collection(RENDER_QUEUE_COLLECTION)
    .where('status', '==', 'processing')
    .where('processingStartedAt', '<', cutoffTime)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  } as RenderQueueJob));
}

/**
 * Retry a failed job
 */
export async function retryJob(jobId: string): Promise<void> {
  await updateRenderJob(jobId, {
    status: 'pending',
    retryCount: 0, // Reset retry count
    lastError: null,
  });
}

/**
 * Get batch statistics for dashboard
 */
export async function getBatchStats(batchId: string): Promise<{
  total: number;
  completed: number;
  failed: number;
  pending: number;
  processing: number;
  percentComplete: number;
  recentCompletions: Array<{
    businessName: string;
    completedAt: string;
    driveUrl: string;
  }>;
  failures: Array<{
    businessName: string;
    error: string;
    retryCount: number;
  }>;
}> {
  const jobs = await getJobsByBatchId(batchId);

  const completed = jobs.filter((j) => j.status === 'completed');
  const failed = jobs.filter((j) => j.status === 'failed');
  const pending = jobs.filter((j) => j.status === 'pending');
  const processing = jobs.filter((j) => j.status === 'processing');

  const percentComplete = jobs.length > 0
    ? Math.round(((completed.length + failed.length) / jobs.length) * 100)
    : 0;

  // Get 5 most recent completions
  const recentCompletions = completed
    .sort((a, b) => {
      const timeA = a.completedAt?.toMillis() || 0;
      const timeB = b.completedAt?.toMillis() || 0;
      return timeB - timeA;
    })
    .slice(0, 5)
    .map((job) => ({
      businessName: job.businessName,
      completedAt: job.completedAt?.toDate().toISOString() || '',
      driveUrl: job.driveUrl || '',
    }));

  // Get all failures
  const failures = failed.map((job) => ({
    businessName: job.businessName,
    error: job.lastError || 'Unknown error',
    retryCount: job.retryCount,
  }));

  return {
    total: jobs.length,
    completed: completed.length,
    failed: failed.length,
    pending: pending.length,
    processing: processing.length,
    percentComplete,
    recentCompletions,
    failures,
  };
}
