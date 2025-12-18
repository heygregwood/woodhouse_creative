// lib/types/renderQueue.ts
// TypeScript types for Creative Automation - Render Queue System

import { Timestamp } from 'firebase-admin/firestore';

/**
 * Render Queue Job
 * Represents a single video render job for one dealer
 */
export interface RenderQueueJob {
  // Identification
  id: string;                       // Firestore document ID
  businessId: string;               // FK to businesses collection
  businessName: string;             // Denormalized for easy display

  // Batch info
  batchId: string;                  // FK to renderBatches collection
  postNumber: number;               // 640, 641, etc.
  templateId: string;               // Creatomate template ID

  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed';

  // Creatomate data
  renderId: string | null;          // From Creatomate API response
  renderUrl: string | null;         // CDN URL of rendered video

  // Google Drive data
  driveFileId: string | null;       // Google Drive file ID
  driveUrl: string | null;          // Public/shareable Drive URL
  drivePath: string | null;         // "Dealers/ABC Heating/2025-11/Post_640.mp4"

  // Tracking timestamps
  createdAt: Timestamp;             // When job added to queue
  processingStartedAt: Timestamp | null;  // When cron picked it up
  completedAt: Timestamp | null;    // When webhook received

  // Error handling
  retryCount: number;               // How many times retried
  lastError: string | null;         // Error message if failed

  // Metadata
  metadata: {
    videoLength: number;            // Seconds
    creditsUsed: number;            // Creatomate credits
    fileSize: number;               // Bytes
  } | null;
}

/**
 * Render Batch
 * Represents a batch of render jobs (one post number for all dealers)
 */
export interface RenderBatch {
  // Identification
  id: string;                       // Firestore document ID
  postNumber: number;               // 640, 641, etc.
  templateId: string;               // Creatomate template ID

  // Progress tracking
  totalJobs: number;                // Total number of dealers (e.g., 28, 58, 140)
  completedJobs: number;            // How many completed
  failedJobs: number;               // How many failed
  pendingJobs: number;              // How many still pending
  processingJobs: number;           // How many currently processing

  // Status
  status: 'queued' | 'processing' | 'completed' | 'partial_failure' | 'failed';

  // Timestamps
  createdAt: Timestamp;
  startedAt: Timestamp | null;      // When first job started processing
  completedAt: Timestamp | null;    // When batch fully complete

  // Metadata
  createdBy: string;                // "greg@woodhouseagency.com"

  // Summary stats
  totalCreditsUsed: number;
  totalFileSize: number;            // Bytes
  averageRenderTime: number;        // Seconds (average per video)

  // Optional reference
  baseVideoUrl?: string;            // URL to base video (for reference)
}

/**
 * Request body for starting a new render batch
 */
export interface CreateRenderBatchRequest {
  postNumber: number;
  templateId: string;
  baseVideoUrl?: string;            // Optional - for reference only
}

/**
 * Response from creating a render batch
 */
export interface CreateRenderBatchResponse {
  status: 'success' | 'error';
  batchId?: string;
  jobsCreated?: number;
  estimatedCompletionTime?: string; // ISO 8601 timestamp
  message: string;
  errors?: string[];
}

/**
 * Batch status response for progress tracking
 */
export interface BatchStatusResponse {
  batchId: string;
  postNumber: number;
  status: RenderBatch['status'];
  progress: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    processing: number;
    percentComplete: number;
  };
  estimatedTimeRemaining: string;   // Human-readable: "6 minutes"
  recentCompletions: Array<{
    businessName: string;
    completedAt: string;            // ISO 8601
    driveUrl: string;
  }>;
  failures: Array<{
    businessName: string;
    error: string;
    retryCount: number;
  }>;
  createdAt: string;                // ISO 8601
  completedAt: string | null;       // ISO 8601 or null
}

/**
 * Creatomate webhook payload
 */
export interface CreatomateWebhookPayload {
  id: string;                       // Render ID
  status: 'succeeded' | 'failed' | 'pending' | 'processing';
  url?: string;                     // Video URL (if succeeded)
  error?: string;                   // Error message (if failed)
  metadata?: string;                // JSON string with jobId, businessId, postNumber
  duration?: number;                // Video duration in seconds
  width?: number;
  height?: number;
  file_size?: number;               // Bytes
}

/**
 * Metadata stored in Creatomate webhook
 */
export interface CreatomateMetadata {
  jobId: string;
  businessId: string;
  postNumber: number;
}

/**
 * Creatomate render request body
 */
export interface CreatomateRenderRequest {
  template_id: string;
  webhook_url: string;
  metadata: string;                 // JSON string
  modifications: {
    [key: string]: string;          // e.g., "dealer-name.text": "ABC Heating"
  };
}

/**
 * Creatomate render response
 */
export interface CreatomateRenderResponse {
  id: string;                       // Render ID
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  url?: string;
  error?: string;
}
