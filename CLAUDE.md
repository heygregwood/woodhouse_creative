# Woodhouse Creative - AI Assistant Context

**Purpose:** Internal creative automation for Woodhouse Agency Allied Air dealers  
**Status:** In development  
**Deployed:** https://woodhouse-creative.vercel.app

---

## Quick Links

| Document | Purpose |
|----------|---------|
| `docs/DATA_ARCHITECTURE.md` | **START HERE** - Complete data model, Excel structure, SQLite schema |
| `docs/WORKFLOW_CURRENT.md` | Current 9-step manual workflow |
| `scripts/` | Python scripts for data import and validation |
| `data/sqlite/creative.db` | Local SQLite database (not deployed) |

---

## This is NOT woodhouse_social

This repo is for **agency operations** (existing Allied dealers).  
`woodhouse_social` is the **SaaS product** (new customers).

They share:
- Same Firebase project (Firestore collections: `businesses`, `renderQueue`, `renderBatches`)
- Same Google Drive service account
- Same Creatomate API key

---

## Source of Truth

**Excel Files (on OneDrive):**
1. `Turnkey Social Media - Dealers - Current.xlsm` - Master dealer database (336 dealers)
2. `Turnkey SM - FOR POSTING - BY REGION.xlsx` - Post scheduling grid

**SQLite Database (local):**
- `~/woodhouse_creative/data/sqlite/creative.db`
- Imported from Excel for faster querying
- Used for validation, reporting, automation

**Firebase Firestore (runtime):**
- Render queue and batch status
- Webhook processing
- Real-time status updates

---

## File Access (Desktop Commander)

Repo lives on WSL Ubuntu. Use this path format:

```
\\wsl$\Ubuntu\home\heygregwood\woodhouse_creative\[file_path]
```

**Excel files on Windows/OneDrive (from WSL):**
```
/mnt/c/Users/GregWood/OneDrive - woodhouseagency.com/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database/
```

**DO NOT use:** `C:\Users\...` or `~/...` for WSL paths

---

## Key Concepts

### Dealer Number
- 8-digit ID assigned by Allied Air (e.g., `10231005`)
- PRIMARY KEY across all systems
- Some manual entries have temp numbers until Allied assigns official one

### Program Status
- `FULL` - We have FB admin access, handle posting
- `CONTENT` - We create content, they post it

### Custom vs Non-Custom Dealers
- **Custom:** Validated name, phone, website, logo → get personalized post copy
- **Non-Custom:** Missing data → just get scheduled date, no personalized content

### Regional Split
- `NORTH` - Cold weather content
- `SOUTH` - Warm weather content
- `CANADA` - Canadian dealers

---

## Stack

- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Local Database:** SQLite (data processing, validation)
- **Runtime Database:** Firebase Firestore (render queue)
- **Video Rendering:** Creatomate API
- **File Storage:** Google Drive (Shared Drive)
- **Hosting:** Vercel

---

## Key Directories

```
woodhouse_creative/
├── app/
│   ├── admin/              # Main admin dashboard
│   └── api/
│       ├── creative/       # Dealer import, batch render APIs
│       ├── cron/           # Process render queue (every minute)
│       └── webhooks/       # Creatomate completion webhook
├── lib/
│   ├── firebase.ts         # Firestore connection
│   ├── creatomate.ts       # Creatomate API client
│   ├── google-drive.ts     # Google Drive upload
│   └── renderQueue.ts      # Queue management
├── scripts/
│   ├── import_excel.py     # Excel → SQLite import
│   └── validate_dealers.py # Data validation pipeline
├── data/
│   └── sqlite/
│       └── creative.db     # Local SQLite database
└── docs/
    ├── DATA_ARCHITECTURE.md  # Complete data model
    └── WORKFLOW_CURRENT.md   # Manual workflow documentation
```

---

## Related Repos

| Repo | Purpose |
|------|---------|
| `woodhouse_social` | SaaS platform (customer signups, Stripe, auth) |
| `prospect_engine` | National HVAC prospect database (145K+), Allied dealer matching |
| `woodhouse_dealer_dashboard` | Static HTML performance reports |

---

## Integration Points

### prospect_engine
- 7,105 Allied Air dealers in `allied_dealers` table
- Website crawling scripts
- Google Maps scraping
- Must respect Allied Air MSA disposition rules

### woodhouse_social
- Brandfetch API for logo fetching
- Firestore collections shared
- Creatomate rendering pipeline

---

## Common Tasks

### Query SQLite database
```bash
sqlite3 ~/woodhouse_creative/data/sqlite/creative.db "SELECT COUNT(*) FROM dealers;"
```

### Run local dev server
```bash
cd ~/woodhouse_creative
npm run dev
```

### Import Excel to SQLite
```bash
cd ~/woodhouse_creative
python3 scripts/import_excel.py
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

## Environment Variables

See `.env.local` for local development. Key variables:
- `FIREBASE_*` - Firestore connection
- `CREATOMATE_API_KEY` - Video rendering
- `GOOGLE_SERVICE_ACCOUNT_*` - Drive access
- `BRANDFETCH_*` - Logo fetching
- `CRON_SECRET` - Secure cron endpoint
