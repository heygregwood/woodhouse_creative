# Woodhouse Creative - AI Assistant Context

**Purpose:** Internal creative automation for Woodhouse Agency Allied Air dealers  
**Live:** TBD (woodhouse-creative.vercel.app)

---

## This is NOT woodhouse_social

This repo is for **agency operations** (existing Allied dealers).  
`woodhouse_social` is the **SaaS product** (new customers).

They share:
- Same Firebase project (Firestore collections: `businesses`, `renderQueue`, `renderBatches`)
- Same Google Drive service account
- Same Creatomate API key

---

## File Access (Desktop Commander)

Repo lives on WSL Ubuntu. Use this path format:

```
\\wsl$\Ubuntu\home\heygregwood\woodhouse_creative\[file_path]
```

**DO NOT use:** `C:\Users\...`, `/home/heygregwood/...`, or `~/...`

---

## Stack

- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Database:** Firebase Firestore
- **Video Rendering:** Creatomate API
- **File Storage:** Google Drive (Shared Drive)
- **Hosting:** Vercel

---

## Key Directories

```
app/
├── admin/              # Main admin dashboard
├── api/
│   ├── creative/       # Dealer import, batch render APIs
│   ├── cron/           # Process render queue
│   └── webhooks/       # Creatomate completion webhook
lib/
├── firebase.ts         # Firestore connection
├── creatomate.ts       # Creatomate API client
├── google-drive.ts     # Google Drive upload
├── renderQueue.ts      # Queue management
└── types/              # TypeScript types
docs/
└── WORKFLOW_CURRENT.md # Full process documentation
```

---

## Firestore Collections (Shared)

- `businesses` - Dealer data (28 Allied dealers)
- `renderQueue` - Individual render jobs
- `renderBatches` - Batch tracking

---

## Git Workflow

```bash
# Development
git add . && git commit -m "message" && git push

# Aliases (if configured)
ga        # git add .
gpush     # git push
gp        # git pull
```

---

## Environment Variables

```bash
# Firebase (same as woodhouse_social)
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Creatomate
CREATOMATE_API_KEY=

# Google Drive
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_DRIVE_ROOT_FOLDER_ID=

# Cron
CRON_SECRET=
```
