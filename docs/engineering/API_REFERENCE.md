# API Reference

**Last Updated:** February 5, 2026
**Base URL:** `https://woodhouse-creative.vercel.app/api`
**Local:** `http://localhost:3000/api`

---

## Overview

35 API endpoints organized into admin, creative, cron, and webhook categories.

---

## Admin Routes `/api/admin/` (26 endpoints)

### Dealer Management

#### GET `/api/admin/dealers`
Fetch dealers with optional filters.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `filter` | string | `not-ready`, `no-logo`, `round2`, `all` |

**Response:** `FirestoreDealer[]`

---

#### GET/POST/PATCH `/api/admin/dealer-review`

**GET:** List dealers by section

| Query Param | Value | Description |
|-------------|-------|-------------|
| `section` | `pending` (default) | Dealers with `review_status = 'pending_review'` |
| `section` | `existing` | All FULL dealers with `ready_for_automate = 'yes'`, sorted by `updated_at` desc |
| `section` | `removed-full` | Removed FULL dealers needing spreadsheet cleanup (`allied_status = 'REMOVED'`, `program_status = 'FULL'`, `scheduling_cleanup_done != true`) |

```json
{
  "success": true,
  "count": 130,
  "dealers": [
    { "dealer_no": "10251015", "dealer_name": "...", "review_status": "pending_review" }
  ]
}
```

**POST:** Approve dealer after review (full automation pipeline)
```json
{
  "dealer_no": "10251015",
  "display_name": "Wiesbrook Sheet Metal",
  "creatomate_phone": "630-555-1234",
  "creatomate_website": "wsminc.net",
  "creatomate_logo": "https://drive.google.com/...",
  "region": "North"
}
```
Triggers: spreadsheet column, post copy population, render batches, emails to dealer + Olivia.

**PATCH:** Update dealer fields only (no automation). Also supports `scheduling_cleanup_done: true` for marking removed FULL dealer spreadsheet cleanup complete.
```json
{
  "dealer_no": "10251015",
  "display_name": "Wiesbrook Sheet Metal",
  "creatomate_phone": "630-555-1234",
  "creatomate_website": "wsminc.net",
  "creatomate_logo": "https://drive.google.com/..."
}
```
All fields except `dealer_no` are optional — only provided fields are updated.

**Response:**
```json
{
  "success": true,
  "dealer_no": "10251015",
  "updated_fields": ["display_name", "creatomate_phone"]
}
```

---

#### POST `/api/admin/dealer-status`
Update dealer program status (from Gmail webhook).

```json
{
  "action": "promote" | "demote",
  "dealer_no": "10251015"
}
```

---

### Logo Management

#### GET `/api/admin/fetch-logos`
Fetch logo options from Brandfetch, website, and Facebook.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `dealer_no` | string | Dealer number |
| `domain` | string | Website domain |
| `facebook_id` | string | Facebook page ID |

**Response:**
```json
{
  "brandfetch": [{ "url": "...", "format": "png" }],
  "website": [{ "url": "...", "source": "favicon" }],
  "facebook": [{ "url": "...", "source": "profile" }]
}
```

---

#### POST `/api/admin/save-logo`
Save selected logo to `creatomate_logo` field.

```json
{
  "dealer_no": "10251015",
  "logo_url": "https://..."
}
```

---

#### POST `/api/admin/save-logo-staging`
Convert logo to PNG and upload to Google Drive staging folder.

```json
{
  "dealer_no": "10251015",
  "logo_url": "https://..."
}
```

**Response:**
```json
{
  "success": true,
  "driveUrl": "https://drive.google.com/file/d/..."
}
```

---

#### POST `/api/admin/save-logo-permanent`
One-click save: converts to PNG, uploads to dealer folder, updates Firestore.

```json
{
  "dealer_no": "10251015",
  "logo_url": "https://original-source.com/logo.jpg"
}
```

---

#### POST `/api/admin/mark-needs-design`
Flag dealers needing logo redesign.

```json
{
  "dealer_no": "10251015",
  "needs_design": true
}
```

---

### Excel Sync (Microsoft Graph API)

#### GET/POST `/api/admin/sync-excel`

**GET:** Preview changes from Allied Excel
```json
{
  "preview": true,
  "changes": {
    "new": [{ "dealer_no": "...", "dealer_name": "..." }],
    "updated": [...],
    "removed": [...]
  }
}
```

**POST:** Apply changes to Firestore

**Note:** Works on both localhost and Vercel via Microsoft Graph API with OAuth2 device code flow.

---

### Email Operations

#### GET/POST `/api/admin/process-done`

**GET:** List dealers with "Done" status in spreadsheet
```json
{
  "dealers": [
    {
      "dealer_no": "10251015",
      "display_name": "...",
      "status": "Done",
      "email_type": "first_post" | "post_scheduled"
    }
  ]
}
```

**POST:** Send email and update status to "Email Sent"
```json
{
  "dealer_no": "10251015"
}
```

---

#### POST `/api/admin/send-welcome-email`
Send welcome email to new dealer.

```json
{
  "dealer_no": "10251015"
}
```

---

#### POST `/api/admin/send-batch-emails`
Send emails to multiple dealers.

```json
{
  "dealer_nos": ["10251015", "10251016"],
  "email_type": "welcome" | "fb_admin_accepted" | "first_post" | "post_scheduled"
}
```

---

#### GET `/api/admin/email-status`
Get email delivery status (delivered, opened, clicked, bounced, complained) for email addresses.

**Query Parameters:** `emails` (comma-separated list of email addresses)

---

#### GET/POST `/api/admin/email-templates`

**GET:** List all email templates or fetch specific template
```json
{
  "templates": ["welcome", "fb_admin_accepted", "first_post_scheduled", ...]
}
```

**POST:** Save template changes
```json
{
  "template": "welcome",
  "content": "<html>..."
}
```

---

### Spreadsheet Operations

#### GET `/api/admin/spreadsheet-status`
Fetch scheduling spreadsheet data.

**Response:**
```json
{
  "dealers": [
    { "dealer_no": "...", "column": "G", "status": "Done" }
  ]
}
```

---

#### GET/POST `/api/admin/populate-post-copy`

**GET:** Preview personalized copy for all dealers
```json
{
  "post_number": 700,
  "base_copy": "Call {name} at {phone}..."
}
```

**POST:** Write personalized copy to spreadsheet
```json
{
  "post_number": 700,
  "base_copy": "Call {name} at {phone}...",
  "preview": false
}
```

---

#### GET `/api/admin/posts-excel`
Fetch post archive spreadsheet data.

---

#### POST `/api/admin/submit-post`
Submit new post to archive.

```json
{
  "post_number": 700,
  "base_copy": "...",
  "season": "Winter",
  "subject": "Heating"
}
```

---

#### POST `/api/admin/create-post`
Full workflow: create post, add to spreadsheet, populate personalized copy, trigger batch renders.

```json
{
  "post_number": 700,
  "template_id": "abc123xyz",
  "base_copy": "Call {name} at {phone}..."
}
```

**Response:**
```json
{
  "success": true,
  "postNumber": 700,
  "dealerCount": 130,
  "batches": [{ "batchId": "batch_abc123" }]
}
```

---

#### POST `/api/admin/generate-copy-deck`
Generate PDF copy deck for CONTENT dealers with video thumbnails (Cloudinary).

```json
{
  "post_numbers": [700, 701, 702]
}
```

**Response:** PDF file download

---

#### POST `/api/admin/populate-mail-merge`
Populate mail merge spreadsheet with CONTENT/NEW dealers from Firestore for welcome email automation.

---

#### GET `/api/admin/post-thumbnail`
Fetch video thumbnail metadata from Google Drive by post number.

**Query Parameters:** `postNumber`

---

#### GET `/api/admin/post-thumbnail-image`
Proxy Google Drive video thumbnails through server.

**Query Parameters:** `fileId`

---

#### GET `/api/admin/template-preview`
Fetch Creatomate template details including preview/snapshot URL.

**Query Parameters:** `templateId`

---

### Utility

#### GET `/api/admin/proxy-image`
Proxy images for canvas rendering (CORS bypass).

**Query Parameters:** `url`

---

#### GET `/api/admin/test-graph-api`
Test Microsoft Graph API connection (for debugging).

---

## Creative Routes `/api/creative/` (6 endpoints)

### Batch Rendering

#### POST `/api/creative/render-batch`
Start batch render for post number.

```json
{
  "post_number": 700,
  "template_id": "abc123xyz",
  "dealer_nos": ["10251015"]  // optional, defaults to all FULL dealers
}
```

**Response:**
```json
{
  "success": true,
  "batchId": "batch_abc123",
  "jobsCreated": 124
}
```

---

#### GET `/api/creative/render-batch`
Get batch status.

**Query Parameters:** `batchId`

---

#### GET `/api/creative/active-batches`
List all active (non-completed) batches.

---

### Testing

#### GET `/api/creative/test-connection`
Test Creatomate + Google Drive connections.

---

#### GET `/api/creative/test-drive-auth`
Test Google Drive authentication.

---

#### POST `/api/creative/manual-webhook`
Manually trigger webhook processing (for testing).

```json
{
  "renderId": "abc123"
}
```

---

## Cron Routes `/api/cron/`

#### GET `/api/cron/process-render-queue`
Process pending render jobs (25 per minute).

**Headers:** `Authorization: Bearer {CRON_SECRET}`

**Schedule:** Every 1 minute via Vercel Cron

**Processing:**
1. Fetches 25 pending jobs
2. Submits to Creatomate API (rate limit: 30 req/10s)
3. Updates job status to `processing`
4. Webhook handles completion

---

## Webhook Routes `/api/webhooks/`

#### POST `/api/webhooks/creatomate`
Receive render completion notifications from Creatomate.

**Headers:** `X-Creatomate-Signature`

**Payload:**
```json
{
  "id": "render_abc123",
  "status": "succeeded",
  "url": "https://creatomate.com/renders/...",
  "metadata": { "jobId": "...", "dealerNo": "..." }
}
```

**Processing:**
1. Validates signature
2. Downloads video from Creatomate
3. Uploads to Google Drive dealer folder
4. Archives old posts if applicable
5. Updates job status to `completed`

---

#### POST `/api/webhooks/resend`
Receive email delivery notifications from Resend.

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message here"
}
```

**Status Codes:**
| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (missing/invalid params) |
| 401 | Unauthorized |
| 404 | Not found |
| 500 | Server error |

---

## Authentication

### Public Routes
- All `/api/admin/*` routes (protected by Vercel deployment)
- All `/api/creative/*` routes

### Protected Routes
- `/api/cron/process-render-queue` - Requires `CRON_SECRET` header
- `/api/webhooks/creatomate` - Requires valid Creatomate signature

---

## Related Documentation

| File | Purpose |
|------|---------|
| [TYPESCRIPT_MODULES.md](TYPESCRIPT_MODULES.md) | lib/*.ts implementation details |
| [DATA_MODEL.md](DATA_MODEL.md) | Firestore schema |
