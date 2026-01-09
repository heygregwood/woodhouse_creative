# Woodhouse Creative - AI Assistant Context

**Purpose:** Internal creative automation for Woodhouse Agency Allied Air dealers
**Status:** Active - 124 FULL dealers ready for automation
**Deployed:** https://woodhouse-creative.vercel.app
**Last Updated:** January 9, 2026

---

## CRITICAL: Read This FIRST Before ANY Code Changes

**MANDATORY WORKFLOW - NO EXCEPTIONS:**

```
1. Make code changes
2. ASK USER: "Ready to test on localhost?" (default 3000, falls back to 3001 if taken)
3. WAIT for user confirmation: "tests pass, push it"
4. ONLY THEN: Commit and push to main
5. Tell user: "Pushed to main - test on Preview (vercel.app)"
6. User tests on Preview
7. User manually deploys to production
```

**NEVER:**
- Push without local testing confirmation
- Push directly to production branch
- Skip waiting for user "tests pass, push it" approval
- Run `npm run build` without asking if dev server is running first
- Start the dev server (`npm run dev`) - let Greg run it so he can Ctrl+C it

This rule applies to ALL changes, even "small" ones.

---

## Documentation Updates - MANDATORY WORKFLOW

When updating any documentation file (.md), follow this process:

1. **Read the actual code file** to confirm current state
2. **Read the doc file** to see what's currently documented
3. **Compare and identify specific deltas** - what's missing, what's outdated, what's wrong
4. **Make targeted edits** (not wholesale rewrites unless necessary)

**NEVER:**
- Update docs based on assumptions about what was built
- Make wholesale rewrites without reading both code and doc first
- Skip the comparison step

This prevents docs from becoming stale because assumptions don't match reality.

---

## Development Workflow

```
LOCAL (localhost:3000) → PREVIEW (vercel.app) → PRODUCTION (woodhouse-creative.vercel.app)
```

| Step | Environment | URL | Branch |
|------|-------------|-----|--------|
| 1. Local | `npm run dev` | localhost:3000 | `main` |
| 2. Preview | Push to `main` | woodhouse-creative.vercel.app | `main` |

### Commands
```bash
# Push to Preview (Production)
ga && git commit -m "message" && gpush
```

### Multi-Machine Workflow (Desktop + Laptop)

**Desktop (Primary Development):**
```bash
# Normal development workflow
npm run dev              # Test on localhost:3000
ga && git commit -m "..." && gpush  # Push to Preview
```

**Laptop (Sync Only):**
```bash
# ONLY sync branches - DO NOT merge or push
git checkout main
git pull origin main
```

### Intermediate Commits During Sessions

**YES - Commit frequently during large changes:**

```bash
# After each logical step/fix
git add .
git commit -m "Step 1: Implement X"
git push

# Continue working
git add .
git commit -m "Step 2: Add Y"
git push
```

**Benefits:**
- Rollback to any step if something breaks
- Better git history showing progress
- Session compaction won't lose work
- Easier to test intermediate states

**When to Commit:**
- After each file/component is working
- Before starting risky refactors
- Every 30-60 minutes during long sessions
- Before switching tasks

---

## Dev Environment

- Windows 11 + WSL2 Ubuntu (8GB RAM limit via .wslconfig)
- Username: `heygregwood`
- Dev server: http://localhost:3000

### WSL Memory Management (CRITICAL - Prevents Crashes)

**Memory Limits:** WSL is configured with 8GB RAM + 4GB swap in `C:\Users\GregWood\.wslconfig`

**BEFORE running `npm run build`:**
1. **ASK GREG:** "Is the dev server running? I need to run a build."
2. **WAIT** for Greg to stop the dev server (Ctrl+C)
3. **THEN** run the build

**NEVER** run `npm run build` while dev server is running - it WILL crash WSL.

**If WSL crashes:** Run in PowerShell:
```powershell
wsl --shutdown
wsl -d Ubuntu
```

**If builds are slow or crashing:** Clean the .next folder first:
```bash
rm -rf .next && npm run build
```

The `.next` folder can balloon to 1-2GB and cause memory issues. Delete it before builds if things get sluggish.

### Build Command
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### Bash Aliases
```bash
gp        # git pull
gs        # git status
dev       # npm run dev
gpush     # git push
ga        # git add .
```

---

## TypeScript & Coding Standards

**These standards are MANDATORY for all new code.**

### Type Safety

**Never use `any`:**
```typescript
// BAD
catch (error: any) {
  setError(error.message);
}

// GOOD
catch (error: unknown) {
  setError(error instanceof Error ? error.message : 'Something went wrong');
}
```

### Error Handling

**API Routes - Standard pattern:**
```typescript
catch (error: unknown) {
  console.error('[route-name] Error:', error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Something went wrong' },
    { status: 500 }
  );
}
```

**Client Components - Standard pattern:**
```typescript
catch (error: unknown) {
  setError(error instanceof Error ? error.message : 'Something went wrong');
}
```

### Logging

**Use bracket prefix for context:**
```typescript
console.log('[sync-excel] Processing dealer:', dealerId);
console.error('[batch-render] Error fetching reels:', error);
```

### API Response Format

**Standard format (pick one per route type):**
```typescript
// Data endpoints - return data directly
return NextResponse.json(dealer);

// Write operations - include success flag
return NextResponse.json({ success: true, id: newId });

// Error responses - always use { error: string }
return NextResponse.json({ error: 'Not found' }, { status: 404 });
```

### Import Organization

**Order imports consistently:**
```typescript
// 1. React/Next.js
import { useState } from 'react';
import { NextRequest, NextResponse } from 'next/server';

// 2. External packages
import Database from 'better-sqlite3';

// 3. Internal libs
import { db } from '@/lib/firebase';

// 4. Types (use 'import type' when possible)
import type { Dealer } from '@/lib/types/dealer';
```

---

## Quick Links

| Document | Purpose |
|----------|---------|
| `docs/END_TO_END_DOCUMENTATION_DRAFT.md` | **Full automation roadmap, API specs, implementation plan** |
| `docs/DATABASE.md` | Database schema, field logic, import scripts |
| `docs/DATA_ARCHITECTURE.md` | Data model overview, Excel structure |
| `docs/WORKFLOW_CURRENT.md` | Current 9-step manual workflow |
| `scripts/` | Python scripts for data import and validation |
| `data/sqlite/creative.db` | Local SQLite database |

---

## Current Status (December 2025)

### 124 FULL Dealers - Data Complete

| Field | Count | Status |
|-------|-------|--------|
| Display Name | 124/124 | Complete |
| Phone | 124/124 | Complete |
| Website | 121/124 | 3 dealers have no website (expected) |
| Logo (Google Drive) | 124/124 | Complete - all validated |
| Facebook ID | 124/124 | Complete |
| **Ready for Automation** | **124/124** | All ready |

### Batch Rendering Complete
- **Posts 666-672 Complete:** 882 videos rendered (Dec 22, 2025)
- All videos uploaded to Google Drive dealer folders
- Cron processes 25 jobs/minute (Creatomate rate limit: 30 req/10s)
- Script: `scripts/batch_render.py`

---

## Automation Features (All Complete)

### 1. Email Automation (Resend API)
- **Account:** communitymanagers@woodhouseagency.com
- **Domain:** woodhouseagency.com (verified)
- **Sender:** `Woodhouse Social Community Managers <communitymanagers@woodhouseagency.com>`

**Email Types:**
| Template | Trigger | File |
|----------|---------|------|
| Welcome | New dealer onboarding | `templates/emails/welcome.html` |
| FB Admin Accepted | After accepting FB admin invite | `templates/emails/fb_admin_accepted.html` |
| First Post Scheduled | First time posts scheduled for FULL dealer | `templates/emails/first_post_scheduled.html` |
| Post Scheduled | Ongoing post notifications | `templates/emails/post_scheduled.html` |
| Content Ready | Monthly content for CONTENT dealers | `templates/emails/content_ready.html` |
| Holiday | Seasonal campaigns | `templates/emails/holiday.html` |

**Scripts:**
- `scripts/email_sender/send_email.py` - Main email sending module
- `scripts/email_sender/blocked_dealers.py` - Blocklist for test accounts
- `scripts/process_done_status.py` - Batch process "Done" status dealers

**Blocked Dealers:**
- Test accounts are blocked from receiving emails via `lib/blocked-dealers.ts` (TypeScript) and `scripts/email_sender/blocked_dealers.py` (Python)
- Currently blocked: `10491009` (GW Berkheimer HQ Test Account)
- To add more: Edit both files and add dealer numbers to the `BLOCKED_DEALER_NOS` set

### 2. Spreadsheet Sync
- Syncs dealer metadata from SQLite to Google Sheets
- Populates personalized post copy from base templates
- Auto-updates email status after sending
- Script: `scripts/sync_spreadsheet.py`

### 3. Batch Video Rendering
- Triggers Creatomate renders for all FULL dealers
- Polls for completion via webhook
- Uploads to Google Drive dealer folders
- Script: `scripts/batch_render.py`
- API: `/api/creative/render-batch`

### 4. Dealer Status Automation
- Gmail monitoring via Apps Script for FB admin invites/removals
- Auto-updates SQLite, spreadsheet, creates Drive folders
- API: `/api/admin/dealer-status`
- Script: `scripts/update_dealer_status.py`

### 5. Dashboard Process Done Emails
- Admin dashboard shows dealers with "Done" status from scheduling spreadsheet
- One-click send for individual dealers or "Process All" button
- Automatically determines first_post vs post_scheduled email type
- API: `/api/admin/process-done`

### 6. Logo Staging with PNG Conversion
- Fetches logos from any source URL
- Converts all formats (jpg, webp, gif, svg) to PNG using Sharp
- Uploads to Google Drive staging folder
- API: `/api/admin/save-logo-staging`

### 7. Populate Post Copy (Dashboard)
- Enter base copy with variable placeholders in dashboard
- Variable picker buttons insert `{name}`, `{phone}`, `{website}` at cursor position
- Populates personalized copy to all dealer columns in scheduling spreadsheet
- Saves base copy to column C for reference
- API: `/api/admin/populate-post-copy`

### 8. Auto-Archive Old Posts
- When new renders complete, old posts are automatically archived
- Reads active post numbers from scheduling spreadsheet column A (rows 13+)
- Moves videos with post numbers NOT in spreadsheet to `Archive/` subfolder
- Archive subfolders are created automatically in each dealer's Drive folder
- Integrated into webhook handler: [route.ts:188-200](app/api/webhooks/creatomate/route.ts#L188-L200)

---

## Google Apps Scripts (External)

These scripts run on Google's servers, not in this codebase. They're managed via https://script.google.com.

### 1. New Dealer Welcome Email
**Location:** communitymanagers@woodhouseagency.com Apps Script
**Name:** "New Dealer Welcome Email"
**Purpose:** Receives webhook from Excel automation, adds row to welcome email sheet for Mail Merge

```javascript
// Key configuration
const SHEET_NAME = 'Sheet1';
const INBOUND_SECRET = '<secret>';
const COLS = ['Brand', 'Distributor', 'BusinessName', 'FirstName', 'LastName',
              'Tier', 'VideoLink', 'EmailAddress', 'FileAttachment',
              'ScheduledDate', 'MailMergeStatus'];

// doPost(e) receives JSON from Excel VBA and appends to sheet
// Sets ScheduledDate = now() so Mail Merge addon auto-sends
```

### 2. Process Done Status (Deprecated)
**Location:** `scripts/google_apps_script/process_done_status.gs` (for reference)
**Status:** Replaced by dashboard button at `/admin` page
**Note:** Was going to be hourly automation but replaced with manual dashboard trigger

---

## Admin Dashboard Pages

### `/admin` - Main Dashboard
- **Excel Sync:** Preview/apply changes from Allied Excel (**LOCAL ONLY** - works on localhost, not Vercel production)
- **Batch Render:** Submit post number + template for rendering
- **Populate Post Copy:** Enter base copy with variable picker, populate to all dealer columns
- **Process Done Emails:** Send emails to dealers marked "Done" in spreadsheet
- **Quick Stats:** 124 FULL dealers, 656+ posts, 100% ready

### `/admin/posts` - Post Workflow
- Create/submit new posts with metadata
- View scheduling spreadsheet status
- Populate post copy to spreadsheet

### `/admin/dealer-review` - Dealer Review & Approval
- List dealers pending review (promoted CONTENT → FULL)
- Manual form for validating display name, phone, website, logo
- Logo selector with Brandfetch + website scraping results

### `/admin/email-templates` - Email Template Editor
- View/edit all 6 email templates
- Preview rendered template
- Save changes back to disk

---

## API Routes (26 Total)

### Admin Routes `/api/admin/` (18 endpoints)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/dealers` | GET | Fetch dealers (filters: not-ready, no-logo, round2, all) |
| `/sync-excel` | GET/POST | Preview/apply changes from Allied Excel (LOCAL ONLY - Python script) |
| `/dealer-review` | GET/POST | List pending dealers / approve after review |
| `/dealer-status` | POST | Update dealer CONTENT ↔ FULL (from Gmail webhook) |
| `/process-done` | GET/POST | Get/send emails to dealers marked "Done" |
| `/email-templates` | GET/POST | List/fetch/save email templates |
| `/fetch-logos` | GET | Fetch logo options from Brandfetch + website |
| `/save-logo` | POST | Save selected logo to creatomate_logo field |
| `/save-logo-staging` | POST | Convert & upload logo to Drive staging folder (PNG) |
| `/proxy-image` | GET | Proxy images for canvas rendering |
| `/mark-needs-design` | POST | Flag dealers needing logo redesign |
| `/send-welcome-email` | POST | Send welcome email (calls Python script) |
| `/send-batch-emails` | POST | Send emails to multiple dealers |
| `/spreadsheet-status` | GET | Fetch scheduling spreadsheet data |
| `/posts-excel` | GET | Fetch post archive spreadsheet |
| `/submit-post` | POST | Submit new post to archive |
| `/open-excel` | GET | Return link to Allied Excel |
| `/populate-post-copy` | GET/POST | Preview/populate personalized post copy to all dealers |

### Creative Automation Routes `/api/creative/` (5 endpoints)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/render-batch` | POST | Start batch render for post number |
| `/render-batch` | GET | Get batch status by batchId |
| `/test-connection` | GET | Test Creatomate + Google Drive |
| `/test-drive-auth` | GET | Test Google Drive auth |
| `/manual-webhook` | POST | Manually trigger webhook (for testing) |

### Cron Routes `/api/cron/`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/process-render-queue` | GET | Process 10 pending render jobs (runs every 1 min) |

### Webhook Routes `/api/webhooks/`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/creatomate` | POST | Receive render completion notifications |

---

## Key Directories

```
woodhouse_creative/
├── app/
│   ├── admin/                  # Admin dashboard pages
│   │   ├── page.tsx            # Main dashboard
│   │   ├── posts/              # Post workflow
│   │   ├── dealer-review/      # Dealer approval
│   │   └── email-templates/    # Template editor
│   └── api/
│       ├── admin/              # Admin operations (17 endpoints)
│       ├── creative/           # Render automation (7 endpoints)
│       ├── cron/               # Scheduled tasks
│       └── webhooks/           # External callbacks
├── lib/
│   ├── firebase.ts             # Firestore connection
│   ├── creatomate.ts           # Creatomate API client
│   ├── google-drive.ts         # Google Drive upload, archive, move files
│   ├── renderQueue.ts          # Queue management (33 functions)
│   └── types/
│       └── renderQueue.ts      # TypeScript interfaces
├── scripts/                    # 59 Python/TypeScript automation scripts
│   ├── email_sender/           # Email automation module
│   │   ├── send_email.py       # Resend API + spreadsheet status update
│   │   └── __init__.py
│   ├── batch_render.py         # Batch video rendering
│   ├── sync_spreadsheet.py     # Sync dealer data to Google Sheets
│   ├── update_dealer_status.py # Promote/demote dealers
│   ├── process_done_status.py  # Process "Done" status dealers
│   ├── add_dealer_to_spreadsheet.py # Add new dealer column
│   ├── export_full_dealers.py  # Export CSV for Creatomate
│   ├── sync_from_excel.py      # Sync from Allied Excel
│   ├── import_creatomate_validated.py
│   ├── verify_logos.py
│   ├── crawl_websites.py
│   └── google_apps_script/     # Reference copies of Apps Scripts
│       └── process_done_status.gs
├── templates/
│   └── emails/                 # HTML email templates (6 total)
│       ├── welcome.html
│       ├── fb_admin_accepted.html
│       ├── first_post_scheduled.html
│       ├── post_scheduled.html
│       ├── content_ready.html
│       └── holiday.html
├── data/
│   ├── sqlite/
│   │   └── creative.db         # SQLite database (source of truth)
│   └── full_dealers_for_creatomate.csv
├── docs/
│   ├── END_TO_END_DOCUMENTATION_DRAFT.md
│   ├── DATABASE.md
│   ├── DATA_ARCHITECTURE.md
│   ├── WORKFLOW_CURRENT.md
│   ├── COMPLIANCE_GUIDE.md
│   ├── COMPLIANCE_WOODHOUSE_CREATIVE.md
│   └── DEALER_NAMES.md
├── public/
│   └── template-bg.png         # Video template background for QA
└── logs/                       # Script execution logs
```

---

## Database Schema

### Main Table: `dealers`
```sql
dealer_no TEXT PRIMARY KEY      -- 8-digit Allied Air ID
dealer_name TEXT                -- Original Allied name
display_name TEXT               -- Cleaned name for videos
program_status TEXT             -- 'FULL' or 'CONTENT'
region TEXT                     -- 'NORTH', 'SOUTH', 'CANADA'

-- Contact
contact_name TEXT
contact_first_name TEXT
contact_email TEXT

-- Creatomate Fields (validated)
creatomate_phone TEXT           -- Formatted: "269-966-9595"
creatomate_website TEXT         -- Domain only: "hotairnow.com"
creatomate_logo TEXT            -- Google Drive URL

-- Tracking
ready_for_automate TEXT         -- 'yes' when all validated
first_post_email_sent TEXT      -- ISO timestamp
last_post_email_sent TEXT       -- ISO timestamp
facebook_page_id TEXT
```

### Other Tables
- `dealer_contacts` - Multi-source contact tracking
- `posts` - Post archive (656+ posts)
- `post_schedule` - Dealer × Post combinations
- `removed_dealers` - Historical archive
- `api_sync_log` - Sync audit trail

---

## Google Drive Resources

**Root Folder:** `Shared drives/Woodhouse Social/Creative Automation/`

| Resource | File ID | Purpose |
|----------|---------|---------|
| Scheduling Spreadsheet | `1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY` | Dealer columns, post rows |
| Posts Excel (No Images) | `1-lhgjbNL1QBFNLZ5eSQSdaJTwIX0JKfE` | Post archive |
| Dealers Folder | `1QwyyE9Pq-p8u-TEz7B5nC-14BERpDPmv` | Individual dealer folders |
| Logos Staging | `1Vht1Dlh-IbyFpxvACbLRN-bVNSRTsrex` | Logo staging folder |

### Scheduling Spreadsheet Structure

| Row | Field | Source |
|-----|-------|--------|
| 1 | Dealer Number | Primary key |
| 2 | Schedule Email Status | Olivia (Pending/Done/Email Sent) |
| 3 | Last Post Date | Olivia |
| 4 | Who Posted | Olivia |
| 5 | First Name | Database |
| 6 | Email | Database |
| 7 | Region | Database |
| 8 | Website | Database |
| 9 | Phone | Database |
| 10 | Distributor | Database |
| 11 | Display Name | Database |
| 12+ | Post Rows | Base copy with {number} placeholder |

---

## Common Tasks

### Send dealer emails
```bash
cd ~/woodhouse_creative
set -a && source .env.local && set +a

# Test (dry run)
python3 scripts/email_sender/send_email.py welcome 10122026 --dry-run

# Send emails
python3 scripts/email_sender/send_email.py welcome 10122026
python3 scripts/email_sender/send_email.py first_post 10122026
python3 scripts/email_sender/send_email.py post_scheduled 10122026
python3 scripts/email_sender/send_email.py fb_admin_accepted 10122026
python3 scripts/email_sender/send_email.py content_ready 10122026 --download-url "https://..."

# Skip spreadsheet update
python3 scripts/email_sender/send_email.py post_scheduled 10122026 --no-spreadsheet
```

### Process "Done" status dealers
```bash
# From CLI (dry run)
python3 scripts/process_done_status.py --dry-run

# From CLI (send emails)
python3 scripts/process_done_status.py

# Or use the dashboard at /admin - "Process Scheduled Emails" section
```

### Add new dealer to spreadsheet
```bash
python3 scripts/add_dealer_to_spreadsheet.py 10122026
python3 scripts/add_dealer_to_spreadsheet.py 10122026 --dry-run
```

### Update dealer status
```bash
# Promote to FULL
python3 scripts/update_dealer_status.py --promote "Dealer Name"
python3 scripts/update_dealer_status.py --promote --dealer-no 10122026

# Demote to CONTENT
python3 scripts/update_dealer_status.py --demote "Dealer Name"
```

### Sync spreadsheet from database
```bash
# Sync dealer metadata (rows 5-11)
python3 scripts/sync_spreadsheet.py --sync-dealers

# Populate post copy for a specific post (CLI)
python3 scripts/sync_spreadsheet.py --post 666

# Both at once
python3 scripts/sync_spreadsheet.py --sync-dealers --post 666
```

### Populate post copy (Dashboard - preferred)
Use the dashboard at `/admin` - "Populate Post Copy" section:
1. Enter post number
2. Type base copy, use variable picker buttons to insert `{name}`, `{phone}`, `{website}`
3. Click "Preview" to see dry run, or "Populate All" to write to spreadsheet

### Batch render videos
```bash
python3 scripts/batch_render.py --post 700 --template abc123
python3 scripts/batch_render.py --post 700 --template abc123 --dealer 10122026
python3 scripts/batch_render.py --post 700 --template abc123 --dry-run
```

### Query database
```bash
sqlite3 ~/woodhouse_creative/data/sqlite/creative.db "SELECT COUNT(*) FROM dealers WHERE program_status = 'FULL';"
```

### Run dev server
```bash
npm run dev
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Local Database | SQLite (better-sqlite3) |
| Runtime Database | Firebase Firestore |
| Video Rendering | Creatomate API |
| File Storage | Google Drive API |
| Email | Resend API |
| Image Processing | Sharp |
| Web Scraping | Cheerio |
| Hosting | Vercel |

---

## Environment Variables

```env
# Firebase
NEXT_PUBLIC_FIREBASE_PROJECT_ID=woodhouse-social
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Creatomate
CREATOMATE_API_KEY=
CREATOMATE_WEBHOOK_SECRET=

# Google Drive
GOOGLE_SERVICE_ACCOUNT_EMAIL=creative-automation@woodhouse-social.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_DRIVE_ROOT_FOLDER_ID=1jOmOJfLRvi2K8gZztoIxAad3cz72A16L
GOOGLE_DRIVE_LOGOS_STAGING_FOLDER_ID=1Vht1Dlh-IbyFpxvACbLRN-bVNSRTsrex

# APIs
BRANDFETCH_API_KEY=
RESEND_API_KEY=

# Security
CRON_SECRET=
```

---

## Key Concepts

### Dealer Number
- 8-digit ID assigned by Allied Air (e.g., `10231005`)
- PRIMARY KEY across all systems
- Exception: `TEMP-XXX` for dealers not yet in Allied system

### Program Status
- `FULL` (124 dealers) - We have FB admin access, handle posting
- `CONTENT` (209 dealers) - We create content, they post it

### Creatomate Fields
All validated for video generation:
- `display_name` - Clean name (proper case, "and" not "&")
- `creatomate_phone` - Formatted: "269-966-9595"
- `creatomate_website` - Domain only: "hotairnow.com"
- `creatomate_logo` - Google Drive shareable URL

### Render Job Lifecycle
1. **Pending** - Created, waiting for cron
2. **Processing** - Submitted to Creatomate
3. **Completed** - Video downloaded, uploaded to Drive
4. **Failed** - Error (retries up to 3x)

---

## Related Repos

| Repo | Purpose |
|------|---------|
| `woodhouse_social` | SaaS platform (customer signups, Stripe, auth) |
| `prospect_engine` | National HVAC prospect database (145K+) |
| `woodhouse_dealer_dashboard` | Static HTML performance reports |

**Note:** This repo is for **agency operations** (existing Allied dealers). `woodhouse_social` is the **SaaS product** (new customers). They share the same Firebase project, Google Drive service account, and Creatomate API key.

---

## Excel Sync Limitations (Important)

The "Sync from Excel" functionality works **LOCAL ONLY** and does **NOT** work on Vercel production.

### Why Local Only?

The Excel file is stored on SharePoint OneDrive at:
```
/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database/Turnkey Social Media - Dealers - Current.xlsm
```

**Challenge:** The file contains VBA macros (FindNewDealers, PostProgramStatus) that are critical to the workflow and only work in desktop Excel.

### What We Tried

**Attempt 1: TypeScript + Microsoft Graph API**
- Created Azure App Registration: "Woodhouse Creative Automation"
- Added Files.Read.All and Sites.Read.All (application permissions)
- Granted admin consent
- Implemented [lib/sync-excel.ts](lib/sync-excel.ts) using `@microsoft/microsoft-graph-client`
- **Result:** Failed - Excel API workbook endpoints require delegated permissions (user context), NOT supported with app-only authentication

**Attempt 2: Download file with Graph API, parse with xlsx library**
- Used `/drives/{id}/items/{fileId}/content` endpoint to download the Excel file
- Used `xlsx` library to parse the downloaded file
- **Result:** Failed - Same "General exception while processing" error, application permissions not sufficient

### Current Solution

The API route [app/api/admin/sync-excel/route.ts](app/api/admin/sync-excel/route.ts) uses Python script [scripts/sync_from_excel.py](scripts/sync_from_excel.py):
- Works locally because Python reads from WSL-mounted OneDrive: `/mnt/c/Users/GregWood/OneDrive - woodhouseagency.com/...`
- Spawns Python subprocess via Node.js `child_process.spawn`
- **Limitation:** Python not available on Vercel serverless functions ("spawn python3 ENOENT")

### Environment Variables

Even though Graph API didn't work, the credentials are documented in [.env.example](.env.example):
```env
MICROSOFT_TENANT_ID=your-tenant-id
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
SHAREPOINT_OWNER_EMAIL=greg@woodhouseagency.com
SHAREPOINT_FILE_PATH=/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database/Turnkey Social Media - Dealers - Current.xlsm
```

### Using Sync from Excel

**Works:** `http://localhost:3000/admin` - Click "Sync from Excel" button
**Doesn't work:** `https://woodhouse-creative.vercel.app/admin` - Button will fail with error

**Manual sync via terminal:**
```bash
cd ~/woodhouse_creative
set -a && source .env.local && set +a
python3 scripts/sync_from_excel.py          # Dry run (preview changes)
python3 scripts/sync_from_excel.py --apply  # Apply changes to database
```

---

## What's Next (Waiting On)

- **Allied Air API credentials** from Billy (developer) - enables automated dealer sync
- Once received, implement `scripts/allied_api.py` for direct OAuth2 connection
