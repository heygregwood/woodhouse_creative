# Woodhouse Creative

Internal creative automation tool for Woodhouse Agency - manages video rendering and distribution for Allied Air dealers.

**Separate from:** [woodhouse_social](https://github.com/heygregwood/woodhouse_social) (SaaS product)

## Purpose

Automates the creation of personalized social media videos for ~28+ Allied Air dealers:
- Batch render videos via Creatomate API
- Auto-organize to Google Drive dealer folders
- Generate post copy for Meta Business Manager
- Track render progress and history

## Stack

- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Database:** Firebase Firestore (shared with woodhouse_social)
- **Video Rendering:** Creatomate API
- **File Storage:** Google Drive (Shared Drive)
- **Hosting:** Vercel

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables (copy from .env.example)
cp .env.example .env.local

# Run development server
npm run dev
```

## Environment Variables

See `.env.example` for required variables. Key ones:
- `CREATOMATE_API_KEY` - Creatomate API key
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Google Drive service account
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` - Service account private key
- `GOOGLE_DRIVE_ROOT_FOLDER_ID` - Creative Automation folder ID
- Firebase credentials (shared with woodhouse_social)

## Workflow Documentation

See `docs/WORKFLOW_CURRENT.md` for the complete end-to-end process.

## Admin Portal

`/admin` - Main dashboard for:
- Importing dealers from CSV
- Starting batch renders
- Monitoring render progress
- Generating scheduling spreadsheets
- Sending dealer notifications
