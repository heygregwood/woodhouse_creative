# TypeScript Modules Reference

**Last Updated:** January 13, 2026
**Location:** `/lib/*.ts`

---

## Overview

Core TypeScript modules that power the API and automation features.

---

## Module Summary

| Module | Purpose | Lines |
|--------|---------|-------|
| [firebase.ts](#firebasets) | Firestore connection | ~60 |
| [firestore-dealers.ts](#firestore-dealersts) | Dealer CRUD operations | ~360 |
| [email.ts](#emailts) | Email sending (6 types) | ~400 |
| [google-sheets.ts](#google-sheetsts) | Spreadsheet operations | ~350 |
| [google-drive.ts](#google-drivets) | File upload/archive | ~400 |
| [creatomate.ts](#creatomatets) | Video rendering API | ~210 |
| [renderQueue.ts](#renderqueuets) | Render job management | ~300 |
| [blocked-dealers.ts](#blocked-dealersts) | Email blocklist | ~40 |
| [microsoft-auth.ts](#microsoft-authts) | Microsoft Graph OAuth2 | ~270 |
| [sync-excel.ts](#sync-excelts) | Excel sync from SharePoint | ~530 |

---

## firebase.ts

**Purpose:** Initialize Firebase Admin SDK and connect to named Firestore database.

**Key Export:**
```typescript
export const db: Firestore  // Proxy to woodhouse-creative-db
```

**Important:** Uses named database `woodhouse-creative-db`, NOT the default database.

```typescript
// CORRECT - uses library
import { db } from '@/lib/firebase';
const doc = await db.collection('dealers').doc('10251015').get();

// WRONG - queries default database
const db = admin.firestore();  // This queries the wrong database!
```

**Environment Variables:**
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

---

## firestore-dealers.ts

**Purpose:** All dealer CRUD operations.

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `getDealer(dealerNo)` | Get single dealer |
| `getDealers(filter?)` | Get dealers with optional filters |
| `createDealer(dealer)` | Create new dealer |
| `updateDealer(dealerNo, updates)` | Partial update |
| `deleteDealer(dealerNo)` | Delete dealer |
| `updateEmailTimestamp(dealerNo, type)` | Track email sends |
| `markDealerRemoved(dealerNo)` | Soft delete |
| `updateLogo(dealerNo, url)` | Update logo URL |
| `markNeedsDesign(dealerNo, flag)` | Flag for design |
| `promoteToFull(dealerNo, pending?)` | CONTENT → FULL |
| `demoteToContent(dealerNo)` | FULL → CONTENT |
| `approveDealer(dealerNo, data)` | Clear review, set fields |
| `batchCreateDealers(dealers)` | Bulk creation |

**Filter Options:**
```typescript
getDealers({
  program_status: 'FULL',
  review_status: 'pending_review',
  ready_for_automate: 'yes',
  logo_needs_design: 1
});
```

---

## email.ts

**Purpose:** Send dealer emails via Resend API.

**Email Types:**

| Function | Template | Trigger |
|----------|----------|---------|
| `sendWelcomeEmail()` | welcome.html | New dealer signup |
| `sendFbAdminAcceptedEmail()` | fb_admin_accepted.html | After FB admin invite accepted |
| `sendFirstPostScheduledEmail()` | first_post_scheduled.html | First posts scheduled |
| `sendPostScheduledEmail()` | post_scheduled.html | Ongoing post notifications |
| `sendContentReadyEmail()` | content_ready.html | Monthly content for CONTENT dealers |
| `sendOnboardingCompleteEmail()` | (internal) | Notify Olivia of new FULL dealer |

**Usage:**
```typescript
import { sendFbAdminAcceptedEmail } from '@/lib/email';

await sendFbAdminAcceptedEmail('10251015');
```

**Environment Variables:**
- `RESEND_API_KEY`

**Sender:** `Woodhouse Social Community Managers <communitymanagers@woodhouseagency.com>`

---

## google-sheets.ts

**Purpose:** Read/write scheduling spreadsheet.

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `getSpreadsheetData()` | Fetch all dealer columns |
| `getDealerColumn(dealerNo)` | Find dealer's column letter |
| `updateDealerStatus(dealerNo, status)` | Update row 2 (Done/Email Sent) |
| `populatePostCopy(postNum, baseCopy)` | Replace {name}, {phone}, {website} |
| `addDealerColumn(dealerNo)` | Add new dealer column |

**Spreadsheet Structure:**
- Row 1: Dealer numbers
- Row 2: Status (Pending/Done/Email Sent)
- Rows 3-12: Dealer metadata
- Rows 13+: Post copy

**Environment Variables:**
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

---

## google-drive.ts

**Purpose:** Upload files to Google Drive dealer folders.

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `uploadVideo(dealerNo, videoUrl, filename)` | Upload rendered video |
| `uploadLogo(dealerNo, logoUrl, filename)` | Upload logo to dealer folder |
| `uploadLogoToStaging(logoUrl, filename)` | Upload to staging folder |
| `archiveOldPosts(dealerNo, activePostNums)` | Move old videos to Archive/ |
| `getDealerFolder(dealerNo)` | Get or create dealer folder |
| `listDealerFiles(dealerNo)` | List files in dealer folder |

**Folder Structure:**
```
Creative Automation/
├── Dealers/
│   ├── 10251015 - Wiesbrook Sheet Metal/
│   │   ├── logo.png
│   │   ├── post-700.mp4
│   │   └── Archive/
│   │       └── post-650.mp4
│   └── ...
└── Logo Staging/
```

**Environment Variables:**
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- `GOOGLE_DRIVE_LOGOS_STAGING_FOLDER_ID`

---

## creatomate.ts

**Purpose:** Creatomate video rendering API client.

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `submitRender(templateId, modifications)` | Start render job |
| `getRenderStatus(renderId)` | Check render progress |
| `downloadRender(renderId)` | Download completed video |
| `fetchFacebookLogo(pageId)` | Get FB profile/cover photo |

**Modifications Structure:**
```typescript
{
  "logo": "https://drive.google.com/...",
  "name": "Wiesbrook Sheet Metal",
  "phone": "630-555-1234",
  "website": "wsminc.net"
}
```

**Rate Limits:**
- 30 requests per 10 seconds
- Cron processes 25 jobs/minute to stay safe

**Environment Variables:**
- `CREATOMATE_API_KEY`
- `CREATOMATE_WEBHOOK_SECRET`

---

## renderQueue.ts

**Purpose:** Firestore render job queue management.

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `createRenderBatch()` | Create batch for post number |
| `createRenderJob()` | Create individual render job |
| `getPendingJobs(limit)` | Get jobs to process |
| `updateJobStatus()` | Mark processing/completed/failed |
| `updateBatchProgress()` | Update batch counters |
| `getActiveBatches()` | List non-completed batches |

**Job Lifecycle:**
```
pending → processing → completed
                   ↘ failed (retries up to 3x)
```

---

## blocked-dealers.ts

**Purpose:** Blocklist for test accounts that shouldn't receive emails.

```typescript
export const BLOCKED_DEALER_NOS = new Set([
  '10491009',  // GW Berkheimer HQ Test Account
]);

export function isDealerBlocked(dealerNo: string): boolean {
  return BLOCKED_DEALER_NOS.has(dealerNo);
}
```

**Note:** Also update `scripts/email_sender/blocked_dealers.py` when adding blocked dealers.

---

## microsoft-auth.ts

**Purpose:** Microsoft Graph API OAuth2 authentication using device code flow.

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `getAuthenticatedGraphClient()` | Get authenticated Graph API client |
| `hasValidToken()` | Check if cached token exists |
| `clearTokenCache()` | Clear cached tokens (logout) |
| `getCachedAccountInfo()` | Get info about authenticated user |

**How It Works:**
1. First call checks for cached token in `.microsoft-token-cache.json`
2. If cached token exists, uses refresh token to get new access token silently
3. If no cached token, prompts user with device code to authenticate
4. User visits `microsoft.com/devicelogin` and enters code
5. After auth, tokens are cached for up to 90 days

**Token Lifetimes:**
- Access token: ~1 hour (auto-refreshed)
- Refresh token: Up to 90 days of inactivity
- Re-authentication only needed every 90 days

**Token Cache File:**
- Location: `.microsoft-token-cache.json` (project root)
- Committed to repo for multi-machine sync (desktop + laptop)
- Contains MSAL token cache with refresh tokens

**CLI Test/Management:**
```bash
# Test authentication
npx tsx scripts/test-microsoft-auth.ts

# Check token status
npx tsx scripts/test-microsoft-auth.ts --status

# Force re-authentication
npx tsx scripts/test-microsoft-auth.ts --clear
```

**Environment Variables:**
- `MICROSOFT_TENANT_ID` - Azure AD tenant ID
- `MICROSOFT_CLIENT_ID` - App registration client ID

**Azure App Registration:**
- Name: "Woodhouse Creative Automation"
- Permissions: Files.ReadWrite.All (Delegated), User.Read (Delegated)
- Public client flows: Enabled

---

## sync-excel.ts

**Purpose:** Sync dealers from Allied Air Excel file on SharePoint to Firestore.

**Status:** Works on both localhost and Vercel (uses Microsoft Graph API with OAuth2).

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `syncFromExcel(apply)` | Sync dealers (dry-run or apply) |
| `readExcelData()` | Read Excel file via Graph API |
| `compareDealers()` | Find new/removed/updated dealers |
| `applyChanges()` | Write changes to Firestore |
| `isAuthenticated()` | Check if Graph API auth is valid |

**Data Flow:**
```
SharePoint Excel → Microsoft Graph API → TypeScript Parser → Firestore
```

**Authentication:**
- Uses `microsoft-auth.ts` for OAuth2 device code flow
- Token cached in `.microsoft-token-cache.json` (valid ~90 days)
- First run on new machine requires device code auth

**Environment Variables:**
- `MICROSOFT_TENANT_ID`
- `MICROSOFT_CLIENT_ID`
- `SHAREPOINT_OWNER_EMAIL` - Drive owner (greg@woodhouseagency.com)
- `SHAREPOINT_FILE_PATH` - Path to Excel file on OneDrive

**Usage:**
```typescript
import { syncFromExcel } from '@/lib/sync-excel';

// Dry run (preview changes)
const { changes } = await syncFromExcel(false);

// Apply changes
const { changes, applied } = await syncFromExcel(true);
```

---

## Related Documentation

| File | Purpose |
|------|---------|
| [API_REFERENCE.md](API_REFERENCE.md) | API endpoints using these modules |
| [DATA_MODEL.md](DATA_MODEL.md) | Firestore schema |
| [PYTHON_SCRIPTS.md](PYTHON_SCRIPTS.md) | Python CLI alternatives |
