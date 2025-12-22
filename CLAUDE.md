# Woodhouse Creative - AI Assistant Context

**Purpose:** Internal creative automation for Woodhouse Agency Allied Air dealers
**Status:** Active - 124 FULL dealers ready for automation
**Deployed:** https://woodhouse-creative.vercel.app
**Last Updated:** December 22, 2025

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
- **Post 666 Complete:** 124/124 videos rendered (Dec 21, 2025)
- All videos uploaded to Google Drive dealer folders
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
- `scripts/process_done_status.py` - Batch process "Done" status dealers

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
- **Excel Sync:** Preview/apply changes from Allied Excel
- **Batch Render:** Submit post number + template for rendering
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

## API Routes (25 Total)

### Admin Routes `/api/admin/` (17 endpoints)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/dealers` | GET | Fetch dealers (filters: not-ready, no-logo, round2, all) |
| `/sync-excel` | GET/POST | Preview/apply changes from Allied Excel |
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
│   ├── google-drive.ts         # Google Drive upload
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

# Populate post copy for a specific post
python3 scripts/sync_spreadsheet.py --post 666

# Both at once
python3 scripts/sync_spreadsheet.py --sync-dealers --post 666
```

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

## What's Next (Waiting On)

- **Allied Air API credentials** from Billy (developer) - enables automated dealer sync
- Once received, implement `scripts/allied_api.py` for direct OAuth2 connection
