# Woodhouse Creative - AI Assistant Context

**Purpose:** Internal creative automation for Woodhouse Agency Allied Air dealers  
**Status:** Active - 95/124 dealers ready for automation  
**Deployed:** https://woodhouse-creative.vercel.app

---

## Quick Links

| Document | Purpose |
|----------|---------|
| `docs/DATABASE.md` | **Database schema, field logic, import scripts** |
| `docs/DATA_ARCHITECTURE.md` | Data model overview, Excel structure |
| `docs/WORKFLOW_CURRENT.md` | Current 9-step manual workflow |
| `scripts/` | Python scripts for data import and validation |
| `data/sqlite/creative.db` | Local SQLite database |

---

## Current Status (December 2025)

### 124 FULL Dealers Data Completeness

| Field | Count | Status |
|-------|-------|--------|
| Phone | 124/124 | ✅ Complete |
| Display Name | 123/124 | 1 missing |
| Website | 121/124 | 3 no website |
| Logo | 122/124 | 2 need logos |
| Facebook ID | 124/124 | ✅ Complete |
| **Ready for Automation** | **95/124** | 29 need QA |

### Key Database Fields for Automation

| Field | Purpose | Example |
|-------|---------|---------|
| `display_name` | Clean company name for reels | "Advantage Heating and Cooling" |
| `creatomate_phone` | Formatted phone with dashes | "269-966-9595" |
| `creatomate_website` | Validated domain | "hotairnow.com" |
| `creatomate_logo` | Google Drive URL | "https://drive.google.com/file/d/..." |
| `ready_for_automate` | All fields validated | "yes" |

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

1. **Creatomate Validated Excel** - `Import Creatomate Data Validated.xlsx`  
   Manually validated fields for automation. **Source of truth for Creatomate fields.**

2. **Allied Dealer Excel** - `Turnkey Social Media - Dealers - Current.xlsm`  
   Master dealer list synced with Allied Air API (336 dealers total)

3. **Sprout Social** - Profile exports  
   Facebook Page IDs for 113 dealers with admin access

4. **Facebook/Google Maps/Website Crawl**  
   Validation and enrichment data stored in `dealer_contacts` table

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

### Program Status
- `FULL` (124 dealers) - We have FB admin access, handle posting
- `CONTENT` (209 dealers) - We create content, they post it

### Creatomate Fields vs Allied Fields
- **Allied fields** (`dealer_name`, `turnkey_phone`, etc.) = raw from API, often wrong
- **Creatomate fields** (`display_name`, `creatomate_phone`, etc.) = validated, ready for video

### Ready for Automation
A dealer is `ready_for_automate = 'yes'` when:
1. Logo resized/rebuilt by Greg
2. Phone validated (business line, not cell)
3. Website validated
4. Company name cleaned (proper case, "and" not "&")

---

## Stack

- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Local Database:** SQLite (`data/sqlite/creative.db`)
- **Runtime Database:** Firebase Firestore (render queue)
- **Video Rendering:** Creatomate API
- **File Storage:** Google Drive (logos, videos)
- **Hosting:** Vercel

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
├── scripts/                # Python data import scripts
│   ├── import_creatomate_validated.py  # Main Creatomate fields import
│   ├── import_excel_full.py            # Allied Excel import
│   ├── import_sprout.py                # Sprout Social FB IDs
│   ├── import_facebook_results.py      # Apify FB scraper
│   └── crawl_websites.py               # Website contact scraping
├── data/
│   └── sqlite/
│       └── creative.db     # Local SQLite database
└── docs/
    ├── DATABASE.md           # Database schema & logic
    ├── DATA_ARCHITECTURE.md  # Architecture overview
    └── WORKFLOW_CURRENT.md   # Manual workflow
```

---

## Common Tasks

### Query SQLite database
```bash
sqlite3 ~/woodhouse_creative/data/sqlite/creative.db "SELECT COUNT(*) FROM dealers WHERE ready_for_automate = 'yes';"
```

### Run Python script
```bash
cd ~/woodhouse_creative
python3 scripts/import_creatomate_validated.py
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
