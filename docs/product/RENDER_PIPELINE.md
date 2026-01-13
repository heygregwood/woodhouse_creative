# Render Pipeline

**Last Updated:** January 13, 2026

---

## Overview

The render pipeline creates personalized videos for each dealer using Creatomate, manages job queues in Firestore, and uploads completed videos to Google Drive.

---

## Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. BATCH CREATION                                              │
│     Admin submits post number + template via dashboard          │
│     API: POST /api/creative/render-batch                        │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. JOB QUEUING                                                 │
│     Creates renderBatch document                                │
│     Creates renderQueue job for each FULL dealer                │
│     Jobs status: 'pending'                                      │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. CRON PROCESSING (every 1 minute)                            │
│     API: GET /api/cron/process-render-queue                     │
│     Fetches 25 pending jobs                                     │
│     Submits to Creatomate API                                   │
│     Updates job status: 'processing'                            │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. CREATOMATE RENDERING                                        │
│     Video rendered with dealer-specific data                    │
│     ~30-60 seconds per video                                    │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. WEBHOOK CALLBACK                                            │
│     API: POST /api/webhooks/creatomate                          │
│     Downloads video from Creatomate                             │
│     Uploads to Google Drive dealer folder                       │
│     Archives old posts                                          │
│     Updates job status: 'completed'                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Rate Limits

| Service | Limit | How We Handle |
|---------|-------|---------------|
| Creatomate API | 30 requests/10 seconds | Cron processes 25 jobs/minute |
| Vercel Cron | 1 execution/minute | Single cron job |
| Google Drive | 1000 requests/100 seconds | Sequential uploads |

---

## Creatomate Template Variables

Each video is rendered with these dealer-specific modifications:

| Variable | Source Field | Example |
|----------|--------------|---------|
| `logo` | `creatomate_logo` | Google Drive URL |
| `name` | `display_name` | "Wiesbrook Sheet Metal" |
| `phone` | `creatomate_phone` | "630-555-1234" |
| `website` | `creatomate_website` | "wsminc.net" |

---

## Job Status Flow

```
pending → processing → completed
              ↓
           failed (retry up to 3x)
              ↓
           failed (permanent)
```

| Status | Description |
|--------|-------------|
| `pending` | Created, waiting for cron pickup |
| `processing` | Submitted to Creatomate, awaiting callback |
| `completed` | Video rendered and uploaded to Drive |
| `failed` | Error occurred, may retry |

---

## Firestore Collections

### `renderBatches`

Tracks overall batch progress.

```typescript
{
  postNumber: 700,
  templateId: "abc123xyz",
  totalJobs: 130,
  completedJobs: 125,
  failedJobs: 2,
  pendingJobs: 0,
  processingJobs: 3,
  status: "processing",
  createdAt: Timestamp,
  createdBy: "admin"
}
```

### `renderQueue`

Individual render jobs.

```typescript
{
  batchId: "batch_abc123",
  businessId: "10251015",
  businessName: "Wiesbrook Sheet Metal",
  postNumber: 700,
  templateId: "abc123xyz",
  status: "completed",
  renderId: "render_xyz789",
  driveFileId: "1abc...",
  driveUrl: "https://drive.google.com/...",
  createdAt: Timestamp,
  completedAt: Timestamp
}
```

---

## Google Drive Output

Videos are uploaded to dealer-specific folders:

```
Creative Automation/
└── Dealers/
    └── 10251015 - Wiesbrook Sheet Metal/
        ├── post-700.mp4        # Current post
        ├── post-701.mp4
        └── Archive/
            └── post-650.mp4    # Old posts auto-archived
```

### Auto-Archive Logic

When new renders complete:
1. Read active post numbers from scheduling spreadsheet (column A, rows 13+)
2. List existing videos in dealer folder
3. Move videos with post numbers NOT in spreadsheet to `Archive/` subfolder

---

## Error Handling

### Creatomate Errors

| Error | Action |
|-------|--------|
| Rate limit | Retry on next cron run |
| Invalid template | Mark job failed, no retry |
| Render failed | Retry up to 3 times |

### Upload Errors

| Error | Action |
|-------|--------|
| Drive quota | Retry on next webhook |
| Network timeout | Retry up to 3 times |
| File exists | Overwrite existing file |

---

## Monitoring

### Check Batch Status

```bash
# Via API
curl https://woodhouse-creative.vercel.app/api/creative/render-batch?batchId=abc123

# Via Firestore
npx tsx -e "
import { db } from './lib/firebase';
const batch = await db.collection('renderBatches').doc('abc123').get();
console.log(batch.data());
"
```

### Check Failed Jobs

```bash
npx tsx -e "
import { db } from './lib/firebase';
const failed = await db.collection('renderQueue')
  .where('status', '==', 'failed')
  .get();
failed.docs.forEach(d => console.log(d.data().businessId, d.data().lastError));
"
```

---

## Manual Operations

### Retry Failed Jobs

```bash
# Reset job to pending
npx tsx -e "
import { db } from './lib/firebase';
await db.collection('renderQueue').doc('JOB_ID').update({
  status: 'pending',
  retryCount: 0,
  lastError: null
});
"
```

### Manual Webhook Trigger

```bash
curl -X POST https://woodhouse-creative.vercel.app/api/creative/manual-webhook \
  -H "Content-Type: application/json" \
  -d '{"renderId": "abc123"}'
```

---

## Related Documentation

| File | Purpose |
|------|---------|
| [../engineering/API_REFERENCE.md](../engineering/API_REFERENCE.md) | API endpoints |
| [../engineering/TYPESCRIPT_MODULES.md](../engineering/TYPESCRIPT_MODULES.md) | renderQueue.ts, creatomate.ts |
| [SPREADSHEET_SYSTEM.md](SPREADSHEET_SYSTEM.md) | Post number tracking |
