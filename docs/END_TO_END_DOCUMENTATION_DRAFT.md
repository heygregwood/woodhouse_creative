# Woodhouse Creative Automation - End to End Documentation

> **Status:** DRAFT  
> **Last Updated:** December 19, 2025  
> **Author:** Greg Wood / Claude  

---

## Overview

This document describes the end-to-end workflow for managing HVAC dealer creative automation, including onboarding new dealers, transitioning them to FULL status, and handling removals. The system integrates Allied Air's API data with Creatomate for automated video/image generation and Sprout Social for posting.

**Key Metrics:**
- Current FULL dealers: 124
- Expected annual churn: ~30% (renewal period: January-February)
- Expected new dealers: 100-200 annually

---

## Current Architecture

### Data Flow Overview

```
Allied Air API ──► Azure Function ──► Excel (Source of Truth)
                                          │
                                          ▼
                                    Manual Updates
                                          │
                                          ▼
                        ┌─────────────────┼─────────────────┐
                        ▼                 ▼                 ▼
               Google Sheets      Creatomate CSV      Azure DB
              (Email Triggers)    (Creative Gen)    (Allied Sync)
```

### Current Components

| Component | Purpose | Technology |
|-----------|---------|------------|
| Allied Air API | Source dealer data | OData REST API with OAuth2 |
| Azure Function (Adaptor) | Transform Allied data for Excel | Azure Functions |
| Excel Workbook | UI for viewing/maintaining data | Excel + VBA Macros |
| Azure Cosmos DB | Store Woodhouse dealer records | Azure Cosmos DB |
| Azure Function (Woodhouse API) | Expose data to Allied Air | Azure Functions |
| Google Sheets | Trigger welcome emails | Mail Merge extension |

---

## Allied Air API Specification

### Authentication
- **OAuth2 Client Credentials Flow**
- Endpoint: `https://<hostname>/authorizationserver/oauth/token`
- Returns: Bearer access token

### Key Endpoints

| Scenario | Filter | Use Case |
|----------|--------|----------|
| All dealers | None | Full sync |
| Opted-in dealers | `turnkeySocialMediaOptIn eq 1` | Active program dealers |
| Delta feed | `modifiedtime ge datetime'YYYY-MM-DD'` | Changes since date |
| Single dealer | `dealerNo eq {id}` | Lookup specific dealer |
| Count | `/$count` | Total dealer count |

### Data Structure (per dealer)
```json
{
  "dealerNo": 42,
  "dealerName": "AIR TIGERS INC",
  "turnkeySocialMediaOptIn": 1,
  "turnkeySocialMediaOptInDate": "/Date(...)/",
  "status": "A",
  "aaeDealerContacts": [{ "contactName", "phone", "emailAddress" }],
  "aaeDealerLocations": [{ "facebook", "streetAddress": { "town", "region" } }],
  "aaeDealerBrands": [{ "brandCode": "ARM" }]
}
```

---

## Woodhouse API Specification (for Allied Air)

### Endpoint: GET /Dealers

Returns dealer status maintained by Woodhouse.

| Field | Type | Description |
|-------|------|-------------|
| dealerNo | String | Allied dealer number |
| programStatus | String | NEW, FULL, or CONTENT |
| sourceIndicator | String | "Allied Dealer Program", "a la carte", or null |
| firstPostDate | Date | yyyy-mm-dd or null |
| lastModificationTime | Datetime | UTC timestamp |

---

## File Inventory

| File Name | Description | Location |
|-----------|-------------|----------|
| Turnkey Social Media - Dealers - Current | Source of Truth (Excel) | OneDrive: `Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database` |
| Turnkey SM - FOR POSTING - BY REGION | Scheduling Spreadsheet | Same folder |
| Import Creatomate Data Validated | Creatomate CSV source | OneDrive: `Woodhouse Business/Creative Automation` |
| Welcome Email #1 | Mail Merge for onboarding | [Google Sheet](https://docs.google.com/spreadsheets/d/18IzBGupaBFflGRk6K0Cu8lfrheUYRq3k8v4LSiPvDK0) |
| Turnkey Dealers Communications | Campaign emails | [Google Sheet](https://docs.google.com/spreadsheets/d/1pJFYtsznMZenCubVSAfsftoWnGrdDN5eb9MhkcweFT8) |

---

## Process Workflows

### 1. New Dealer Onboarding (API → CONTENT Status)

**Trigger:** API finds new dealer

| Step | Current | Automation Opportunity |
|------|---------|----------------------|
| 1 | Click "Refresh Data" button in Excel | Scheduled script (daily/hourly) |
| 2 | VBA macro calls Azure Function | Python script direct to Allied API |
| 3 | New dealers added to "Woodhouse Data" tab | Auto-insert to SQLite DB |
| 4 | Row added to Google Sheet | API call to Google Sheets |
| 5 | Manual run Mail Merge | Resend API triggered email |
| **Email:** | Welcome Email #1 | Auto-send on new dealer |

### 2. Dealer Converts to FULL (FB Admin Access Granted)

**Trigger:** Email received that dealer added FB admin

| Step | Current | Automation Opportunity |
|------|---------|----------------------|
| 1 | Manually update status in Excel | Gmail trigger → auto-update DB |
| 2 | Add to "FOR POSTING - BY REGION" | Auto-add to posting schedule |
| 3 | Add to "Creatomate Data Validated" | Auto-generate Creatomate CSV |
| 4 | Fetch/create logo | Brandfetch API → website scrape |
| 5 | Manual send email | Auto-send via Resend API |
| **Email:** | We're Ready to Start Posting | Auto-send on FULL transition |

### 3. FULL Dealer Removed (API Shows Removal)

**Trigger:** API pull shows dealer removed

| Step | Current | Automation Opportunity |
|------|---------|----------------------|
| 1 | VBA moves to "Removed Dealers" tab | Auto-flag in DB |
| 2 | Manual remove from posting schedule | Auto-remove from active lists |
| 3 | Manual remove from Creatomate | Auto-regenerate CSV |

### 4. Dealer Removes Admin Access (FULL → CONTENT)

**Trigger:** Dealer removes FB admin access (detected via Meta API or manual)

| Step | Current | Automation Opportunity |
|------|---------|----------------------|
| 1 | Manual status change to CONTENT | Meta webhook → auto-update |
| 2 | Remove from posting/Creatomate | Auto-sync |

### 5. Post Scheduling & Notification

**Trigger:** Post scheduled for dealer

| Step | Current | Automation Opportunity |
|------|---------|----------------------|
| 1 | Copy data to communications sheet | Auto-populate from schedule |
| 2 | Run Mail Merge with Claude copy | Template + auto-send |

---

## Automation Roadmap

### Phase 1: Replace Excel with SQLite + Python (Priority: HIGH)

**Goal:** Eliminate Excel macro dependency, enable scripted automation.

**Components:**
1. **Allied API Client** (`/scripts/allied_api.py`)
   - Direct OAuth2 authentication
   - Fetch all dealers / delta / single dealer
   - No Azure Function needed

2. **Sync Script** (`/scripts/sync_dealers.py`)
   - Compare API data to local DB
   - Detect: new dealers, removed dealers, changed status
   - Log all changes to activity table

3. **SQLite Database** (existing: `/data/sqlite/creative.db`)
   - Already has dealer data structure
   - Add: `allied_sync_at`, `allied_opt_in_date`, `allied_status`

**Benefits:**
- Can run on schedule (cron or Windows Task Scheduler)
- No manual button clicks
- Full audit trail in DB
- Can trigger downstream actions programmatically

### Phase 2: Automated Email Triggers (Priority: HIGH) ✅ COMPLETE

**Status:** Implemented December 2025

**Components:**
1. **Resend API Integration** (`/scripts/email/send_email.py`)
   - Account: communitymanagers@woodhouseagency.com
   - Domain: woodhouseagency.com
   - Welcome Email → on new dealer
   - First Post Scheduled → on first FULL posting
   - Post Scheduled → on ongoing posts
   - Content Ready → for CONTENT dealers (monthly download)

2. **Email Templates** (`/templates/emails/`)
   - `welcome.html` - Welcome to Turnkey Social Media Program
   - `first_post_scheduled.html` - Your Social Media Posts Are Now Scheduled!
   - `post_scheduled.html` - Your Latest Social Media Content Has Been Scheduled
   - `content_ready.html` - Social Media Content is Ready to Download

**Usage:**
```bash
# Send welcome email
python3 scripts/email/send_email.py welcome 10122026

# Dry run (test without sending)
python3 scripts/email/send_email.py welcome 10122026 --dry-run
```

**Benefits:**
- No manual Mail Merge runs
- Consistent timing
- Trackable (open/click rates via Resend dashboard)

### Phase 3: Creatomate CSV Auto-Generation (Priority: MEDIUM)

**Goal:** Auto-generate Creatomate-ready CSV when dealers change.

**Components:**
1. **Export Script** (`/scripts/export_creatomate.py`)
   - Query FULL dealers from DB
   - Output: Business Name, Phone, Website, Logo URL
   - Save to OneDrive folder (or upload via API)

2. **Logo Pipeline**
   - Auto-fetch on new FULL dealer
   - QA queue for manual review
   - Upload to Google Drive

**Benefits:**
- Always up-to-date CSV
- No copy/paste errors
- Triggered on status change

### Phase 4: Meta API Integration (Priority: MEDIUM)

**Goal:** Detect FB admin access changes automatically.

**Components:**
1. **Meta Graph API Client**
   - Check page admin status
   - Webhook for permission changes

2. **Status Sync**
   - Auto-update FULL ↔ CONTENT based on actual access

**Benefits:**
- No relying on email notifications
- Real-time status accuracy

### Phase 5: Full Dashboard (Priority: LOW - Future)

**Goal:** Web UI replacing Excel entirely.

**Components:**
1. **Admin Dashboard** (Next.js)
   - View all dealers
   - Manual status overrides
   - Activity log
   - Email preview/send

2. **Woodhouse Social Integration**
   - Shared database
   - Customer can see their status

---

## Proposed New Architecture

```
Allied Air API
      │
      ▼ (Python script, scheduled)
┌─────────────────────────────────┐
│     SQLite Database             │
│   (Source of Truth)             │
│  - dealers table                │
│  - activity_log table           │
│  - sync_history table           │
└─────────────────────────────────┘
      │
      ├──► Resend API (emails)
      │
      ├──► Google Drive (logos)
      │
      ├──► Creatomate CSV (auto-export)
      │
      └──► Azure Function (Woodhouse API for Allied)
```

---

## Implementation Plan for January

### Week 1: Allied API Direct Integration
- [ ] Get API credentials from developer
- [ ] Build Python client for Allied API
- [ ] Test delta sync
- [ ] Set up scheduled task

### Week 2: Email Automation ✅ COMPLETE (Dec 2025)
- [x] Set up Resend account (communitymanagers@woodhouseagency.com)
- [x] Create email templates
- [x] Build trigger logic in send_email.py
- [ ] Test with sample dealers
- [ ] Verify domain in Resend (DNS records)

### Week 3: Creatomate Pipeline
- [ ] Auto-generate CSV on FULL changes
- [ ] Logo fetch pipeline
- [ ] QA review workflow

### Week 4: Testing & Go-Live
- [ ] Run parallel with Excel for 1 week
- [ ] Fix discrepancies
- [ ] Cut over to automated system

---

## Database Schema

**Location:** `/home/heygregwood/woodhouse_creative/data/sqlite/creative.db`

### dealers table (key fields)

| Field | Type | Description |
|-------|------|-------------|
| dealer_no | TEXT | Allied dealer number (PK) |
| display_name | TEXT | Business name for creative |
| program_status | TEXT | FULL, CONTENT, NEW |
| source_indicator | TEXT | Allied Dealer Program, a la carte |
| first_post_date | DATE | First post date |
| creatomate_phone | TEXT | Phone for creative |
| creatomate_website | TEXT | Website URL |
| creatomate_logo | TEXT | Google Drive logo URL |
| allied_opt_in | INTEGER | 0/1 from Allied API |
| allied_sync_at | DATETIME | Last sync timestamp |
| created_at | DATETIME | Record created |
| updated_at | DATETIME | Last modification |

### activity_log table (new)

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | Auto-increment |
| dealer_no | TEXT | Related dealer |
| action | TEXT | NEW_DEALER, STATUS_CHANGE, REMOVED, EMAIL_SENT |
| details | TEXT | JSON with change details |
| created_at | DATETIME | When action occurred |

---

## Scripts Reference

| Script | Purpose | Status |
|--------|---------|--------|
| `scripts/email/send_email.py` | Send triggered emails via Resend | ✅ Ready |
| `scripts/allied_api.py` | Allied API client | TODO |
| `scripts/sync_dealers.py` | Sync Allied → DB | TODO |
| `scripts/export_full_dealers.py` | Generate Creatomate CSV | ✅ Ready |
| `scripts/fetch_logos.py` | Brandfetch/scrape logos | ✅ Ready |

---

## Questions for Developer (Billy Boebel)

1. Can we get direct access to Allied API credentials (client_id, client_secret)?
2. Is the Azure Function source code available?
3. What's the current Azure Cosmos DB schema?
4. Is the Woodhouse API (for Allied consumption) still needed if we sync directly?
5. Any rate limits on Allied API we should be aware of?

---

## Validation Status

| Region | Status |
|--------|--------|
| North | ✅ Validated |
| South | ❌ Needs validation |
| Canada | ❌ Needs validation |

---

## Revision History

| Date | Change | Author |
|------|--------|--------|
| 2024-12-19 | Initial draft created | Claude |
| 2024-12-19 | Added API specs and automation roadmap | Claude |
| 2025-12-19 | Email automation complete (Resend integration) | Claude |
