# Woodhouse Creative - AI Assistant Context

**Purpose:** Internal creative automation for Woodhouse Agency Allied Air dealers
**Status:** Active - 124 FULL dealers ready for automation
**Deployed:** https://woodhouse-creative.vercel.app

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

### 124 FULL Dealers - Data Complete ✅

| Field | Count | Status |
|-------|-------|--------|
| Display Name | 124/124 | ✅ Complete |
| Phone | 124/124 | ✅ Complete |
| Website | 121/124 | 3 dealers have no website (expected) |
| Logo (Google Drive) | 124/124 | ✅ Complete - all validated |
| Facebook ID | 124/124 | ✅ Complete |
| **Ready for Automation** | **124/124** | ✅ All ready |

### CSV Export Ready
- `data/full_dealers_for_creatomate.csv` - All 124 dealers ready for Creatomate upload
- Script: `scripts/export_full_dealers.py`

### Batch Rendering ✅
- **Post 666 Complete:** 124/124 videos rendered (Dec 21, 2025)
- All videos uploaded to Google Drive dealer folders
- Script: `scripts/batch_render.py`

---

## What's Next (Automation Roadmap)

### Waiting On
- **Allied Air API credentials** from Billy (developer) - enables automated dealer sync

### Completed
1. **Email Automation (Resend API)** ✅
   - Account: communitymanagers@woodhouseagency.com
   - Templates: Welcome, First Post Scheduled, Post Scheduled, Content Ready
   - Scripts: `scripts/email_sender/send_email.py`
   - Auto-updates spreadsheet to "Email Sent" after sending

2. **Spreadsheet Sync** ✅
   - Syncs dealer metadata from SQLite to Google Sheets
   - Populates personalized post copy from base templates
   - Script: `scripts/sync_spreadsheet.py`

3. **Batch Video Rendering** ✅
   - Triggers Creatomate renders for all FULL dealers
   - Polls for completion, uploads to Google Drive
   - Script: `scripts/batch_render.py`

4. **Dealer Status Automation** ✅
   - Gmail monitoring via Apps Script for FB admin invites/removals
   - Auto-updates SQLite, spreadsheet, creates Drive folders
   - API: `/api/admin/dealer-status`
   - Script: `scripts/update_dealer_status.py`
   - Apps Script: `scripts/gmail_monitor.gs`

### Ready to Build
1. **Allied API Integration**
   - Direct OAuth2 to Allied (bypass Azure Function)
   - Delta sync: new dealers, removals, status changes
   - Script: `scripts/allied_api.py` (TODO)

2. **Creatomate Auto-Export**
   - Trigger CSV regeneration on dealer changes
   - Auto-upload to OneDrive or Creatomate API

See `docs/END_TO_END_DOCUMENTATION_DRAFT.md` for full implementation plan.

---

## This is NOT woodhouse_social

This repo is for **agency operations** (existing Allied dealers).  
`woodhouse_social` is the **SaaS product** (new customers).

They share:
- Same Firebase project (Firestore collections: `businesses`, `renderQueue`, `renderBatches`)
- Same Google Drive service account
- Same Creatomate API key

---

## Data Sources (Priority Order)

1. **SQLite Database** - `data/sqlite/creative.db`
   **Source of truth** for all dealer data

2. **Creatomate Validated Excel** - `Import Creatomate Data Validated.xlsx`
   Legacy source - data now imported to SQLite

3. **Allied Dealer Excel** - `Turnkey Social Media - Dealers - Current.xlsm`
   Master dealer list synced with Allied Air API (336 dealers total)

4. **Sprout Social** - Profile exports
   Facebook Page IDs for dealers with admin access

---

## Google Drive Resources

All files in: `Shared drives/Woodhouse Social/Creative Automation/Scheduling Spreadsheet/`

| Resource | File ID | Purpose |
|----------|---------|---------|
| Scheduling Spreadsheet | `1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY` | Dealer columns, post rows, Olivia's workflow |
| Posts Excel (No Images) | `1-lhgjbNL1QBFNLZ5eSQSdaJTwIX0JKfE` | Post archive - read/write by automation |
| Posts Excel (With Images) | (separate file) | Client-facing archive - manual updates only |

### Posts Excel Structure
| Column | Field | Description |
|--------|-------|-------------|
| A | Post # | Sequential post number (1-656+) |
| B | Season | Fall, Winter, Spring, Summer |
| C | Post Copy | Social media copy text |
| D | Image | Image reference (manual) |
| E | Subject Matter | Topic category |
| F-H | Tag 1-3 | Content tags |
| I | Notes | Creation date |
| J | Comments | Additional notes |
| K | AAE APPROVED | Approval status |

---

## File Access (Desktop Commander)

Repo lives on WSL Ubuntu. Use this path format:

```
\\wsl$\Ubuntu\home\heygregwood\woodhouse_creative\[file_path]
```

**Excel files on Windows/OneDrive (from WSL):**
```
/mnt/c/Users/GregWood/OneDrive - woodhouseagency.com/Woodhouse Business/...
```

**DO NOT use:** `C:\Users\...` or `~/...` for WSL paths in Desktop Commander

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
All validated and ready for video generation:
- `display_name` - Clean company name (proper case, "and" not "&")
- `creatomate_phone` - Formatted with dashes (e.g., "269-966-9595")
- `creatomate_website` - Domain only (e.g., "hotairnow.com")
- `creatomate_logo` - Google Drive shareable URL

### Ready for Automation
`ready_for_automate = 'yes'` means:
1. ✅ Logo uploaded to Google Drive and validated
2. ✅ Phone validated (business line)
3. ✅ Website validated
4. ✅ Display name cleaned

---

## Stack

- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Local Database:** SQLite (`data/sqlite/creative.db`)
- **Runtime Database:** Firebase Firestore (render queue)
- **Video Rendering:** Creatomate API
- **File Storage:** Google Drive (logos, videos)
- **Hosting:** Vercel
- **Email:** Resend API

### Resend Configuration
- **Account:** communitymanagers@woodhouseagency.com
- **Domain:** woodhouseagency.com
- **Sender:** `Woodhouse Social Community Managers <communitymanagers@woodhouseagency.com>`
- **Note:** Separate account from woodhouse_social (keeps SaaS and agency ops isolated)

---

## Key Directories

```
woodhouse_creative/
├── app/
│   ├── admin/              # Main admin dashboard
│   └── api/
│       ├── creative/       # Dealer import, batch render APIs
│       ├── cron/           # Process render queue
│       └── webhooks/       # Creatomate completion webhook
├── lib/
│   ├── firebase.ts         # Firestore connection
│   ├── creatomate.ts       # Creatomate API client
│   ├── google-drive.ts     # Google Drive upload
│   └── renderQueue.ts      # Queue management
├── scripts/
│   ├── email_sender/       # Email automation module
│   │   ├── send_email.py   # Resend API + spreadsheet status update
│   │   └── __init__.py
│   ├── batch_render.py                 # Batch video rendering via Creatomate
│   ├── sync_spreadsheet.py             # Sync dealer data to Google Sheets
│   ├── update_dealer_status.py         # Promote/demote dealers (CONTENT <-> FULL)
│   ├── gmail_monitor.gs                # Apps Script for Gmail FB admin monitoring
│   ├── export_full_dealers.py          # Export CSV for Creatomate
│   ├── import_creatomate_validated.py  # Import from Excel
│   ├── verify_logos.py                 # Logo URL validation
│   └── crawl_websites.py               # Website contact scraping
├── templates/
│   └── emails/             # HTML email templates
│       ├── welcome.html
│       ├── fb_admin_accepted.html
│       ├── first_post_scheduled.html
│       ├── post_scheduled.html
│       └── content_ready.html
├── data/
│   ├── sqlite/
│   │   └── creative.db     # SQLite database (source of truth)
│   └── full_dealers_for_creatomate.csv # Export for Creatomate
└── docs/
    ├── END_TO_END_DOCUMENTATION_DRAFT.md  # Automation roadmap
    ├── DATABASE.md                         # Database schema
    ├── DATA_ARCHITECTURE.md                # Architecture overview
    └── WORKFLOW_CURRENT.md                 # Manual workflow
```

---

## Common Tasks

### Query SQLite database
```bash
sqlite3 ~/woodhouse_creative/data/sqlite/creative.db "SELECT COUNT(*) FROM dealers WHERE program_status = 'FULL';"
```

### Export Creatomate CSV
```bash
cd ~/woodhouse_creative
python3 scripts/export_full_dealers.py
```

### Send dealer emails
```bash
cd ~/woodhouse_creative
set -a && source .env.local && set +a

# Test (dry run - prints email without sending)
python3 scripts/email_sender/send_email.py welcome 10122026 --dry-run

# Send welcome email
python3 scripts/email_sender/send_email.py welcome 10122026

# Send post scheduled email (auto-updates spreadsheet to "Email Sent")
python3 scripts/email_sender/send_email.py post_scheduled 10122026

# Skip spreadsheet update
python3 scripts/email_sender/send_email.py post_scheduled 10122026 --no-spreadsheet

# Send content ready email (requires download URL)
python3 scripts/email_sender/send_email.py content_ready 10122026 --download-url "https://dropbox.com/..."

# Send FB admin accepted email (manual - after accepting invite)
python3 scripts/email_sender/send_email.py fb_admin_accepted 10122026
```

### Update dealer status (CONTENT <-> FULL)
```bash
cd ~/woodhouse_creative
set -a && source .env.local && set +a

# Promote dealer to FULL (by name)
python3 scripts/update_dealer_status.py --promote "Frank Devos National Heating and Cooling"

# Demote dealer to CONTENT (by name)
python3 scripts/update_dealer_status.py --demote "Owen AC Services, LLC"

# By dealer number
python3 scripts/update_dealer_status.py --promote --dealer-no 10122026

# Preview only
python3 scripts/update_dealer_status.py --dry-run --promote "Test Dealer"
```

### Sync spreadsheet from database
```bash
cd ~/woodhouse_creative
set -a && source .env.local && set +a

# Sync dealer metadata (rows 5-11)
python3 scripts/sync_spreadsheet.py --sync-dealers

# Populate post copy for a specific post
python3 scripts/sync_spreadsheet.py --post 666

# Both at once
python3 scripts/sync_spreadsheet.py --sync-dealers --post 666

# Preview only
python3 scripts/sync_spreadsheet.py --sync-dealers --dry-run
```

### Batch render videos
```bash
cd ~/woodhouse_creative
set -a && source .env.local && set +a

# Render for all FULL dealers
python3 scripts/batch_render.py --post 700 --template abc123

# Test with single dealer
python3 scripts/batch_render.py --post 700 --template abc123 --dealer 10122026

# Skip specific dealers
python3 scripts/batch_render.py --post 700 --template abc123 --skip "10122026,10231005"

# Preview only
python3 scripts/batch_render.py --post 700 --template abc123 --dry-run
```

### Run local dev server
```bash
cd ~/woodhouse_creative
npm run dev
```

---

## Git Workflow

```bash
# Push changes
ga && git commit -m "message" && gpush

# Pull changes locally
gp
```

---

## Related Repos

| Repo | Purpose |
|------|---------|
| `woodhouse_social` | SaaS platform (customer signups, Stripe, auth) |
| `prospect_engine` | National HVAC prospect database (145K+) |
| `woodhouse_dealer_dashboard` | Static HTML performance reports |

---

## Environment Variables

See `.env.local` for local development. Key variables:
- `FIREBASE_*` - Firestore connection
- `CREATOMATE_API_KEY` - Video rendering
- `GOOGLE_SERVICE_ACCOUNT_*` - Drive access
- `RESEND_API_KEY` - Email sending (configured)
