# Python Scripts Reference

**Last Updated:** January 13, 2026
**Location:** `/scripts/`
**Status:** LOCAL CLI FALLBACKS - Primary implementation is TypeScript API

---

## Overview

These Python scripts are **local CLI fallbacks** that read from SQLite. The primary implementation is the TypeScript API routes that read from Firestore.

**When to use Python scripts:**
- When TypeScript API is unavailable
- For bulk operations from command line
- For debugging/testing

**Important:** Python scripts read from SQLite, not Firestore. Data may be slightly out of sync.

---

## Script Summary

| Script | Purpose | API Equivalent |
|--------|---------|----------------|
| `batch_render.py` | Batch video rendering | POST `/api/creative/render-batch` |
| `sync_from_excel.py` | Excel → SQLite sync | POST `/api/admin/sync-excel` |
| `process_done_status.py` | Process "Done" dealers | POST `/api/admin/process-done` |
| `update_dealer_status.py` | Promote/demote dealers | POST `/api/admin/dealer-status` |
| `sync_spreadsheet.py` | Sync to Google Sheets | GET/POST various endpoints |
| `add_dealer_to_spreadsheet.py` | Add dealer column | POST `/api/admin/dealer-review` |
| `populate_post_copy.py` | Populate post copy | POST `/api/admin/populate-post-copy` |

---

## Environment Setup

```bash
cd ~/woodhouse_creative
set -a && source .env.local && set +a
```

---

## Scripts

### batch_render.py

Batch render videos for a post number.

```bash
# Dry run
python3 scripts/batch_render.py --post 700 --template abc123 --dry-run

# Single dealer
python3 scripts/batch_render.py --post 700 --template abc123 --dealer 10251015

# All FULL dealers
python3 scripts/batch_render.py --post 700 --template abc123
```

**Options:**
- `--post` - Post number (required)
- `--template` - Creatomate template ID (required)
- `--dealer` - Single dealer number (optional)
- `--dry-run` - Preview only

---

### sync_from_excel.py

Sync from Allied Air Excel to SQLite (LOCAL ONLY).

```bash
# Preview changes
python3 scripts/sync_from_excel.py

# Apply changes
python3 scripts/sync_from_excel.py --apply
```

**Note:** Excel path depends on `WINDOWS_USERNAME` environment variable.

| Machine | WINDOWS_USERNAME | Path |
|---------|-----------------|------|
| Desktop | GregWood | `/mnt/c/Users/GregWood/OneDrive...` |
| Laptop | gregw | `/mnt/c/Users/gregw/OneDrive...` |

---

### process_done_status.py

Send emails to dealers marked "Done" in scheduling spreadsheet.

```bash
# Dry run
python3 scripts/process_done_status.py --dry-run

# Send emails
python3 scripts/process_done_status.py
```

Determines email type automatically:
- `first_post_scheduled` - if `first_post_email_sent` is null
- `post_scheduled` - otherwise

---

### update_dealer_status.py

Promote or demote dealers between CONTENT and FULL.

```bash
# Promote by name
python3 scripts/update_dealer_status.py --promote "Wiesbrook Sheet Metal"

# Promote by dealer number
python3 scripts/update_dealer_status.py --promote --dealer-no 10251015

# Demote
python3 scripts/update_dealer_status.py --demote "Wiesbrook Sheet Metal"
```

---

### sync_spreadsheet.py

Sync dealer metadata to Google Sheets. Reads from SQLite and writes rows 5-11 for each dealer column.

**Note:** Uses SQLite (legacy). The TypeScript version in `lib/google-sheets.ts` is used by the admin dashboard for new dealer onboarding.

**Row mapping:**
| Row | Field | DB Column |
|-----|-------|-----------|
| 5 | First Name | `contact_first_name` |
| 6 | Email | `contact_email` |
| 7 | Region | `region` |
| 8 | Website | `creatomate_website` |
| 9 | Phone | `creatomate_phone` |
| 10 | Distributor | `distributor_name` |
| 11 | Display Name | `display_name` |

**Bug fix (2026-02-05):** Row 10 was writing `dealer_name` instead of `distributor_name`. Fixed in SQL query and row write. All 124 columns corrected.

```bash
# Sync dealer metadata (rows 5-11)
python3 scripts/sync_spreadsheet.py --sync-dealers

# Populate post copy for specific post
python3 scripts/sync_spreadsheet.py --post 700

# Both
python3 scripts/sync_spreadsheet.py --sync-dealers --post 700
```

---

### add_dealer_to_spreadsheet.py

Add new dealer column to scheduling spreadsheet.

```bash
# Dry run
python3 scripts/add_dealer_to_spreadsheet.py 10251015 --dry-run

# Add column
python3 scripts/add_dealer_to_spreadsheet.py 10251015
```

Populates:
- Row 1: Dealer number
- Row 2: "Pending"
- Rows 5-11: Dealer metadata from SQLite

---

### populate_post_copy.py

Populate personalized post copy to all dealer columns.

```bash
python3 scripts/populate_post_copy.py --post 700 --copy "Call {name} at {phone}!"
```

**Variables:**
- `{name}` - display_name
- `{phone}` - creatomate_phone
- `{website}` - creatomate_website

---

## Email Sender Module

**Location:** `scripts/email_sender/`

### send_email.py

Send emails to dealers.

```bash
# Dry run
python3 scripts/email_sender/send_email.py welcome 10251015 --dry-run

# Send
python3 scripts/email_sender/send_email.py welcome 10251015

# Skip spreadsheet update
python3 scripts/email_sender/send_email.py post_scheduled 10251015 --no-spreadsheet
```

**Email Types:**
- `welcome`
- `fb_admin_accepted`
- `first_post`
- `post_scheduled`
- `content_ready` (requires `--download-url`)

---

### blocked_dealers.py

Blocklist for test accounts.

```python
BLOCKED_DEALER_NOS = {'10491009'}  # GW Berkheimer HQ Test Account

def is_blocked(dealer_no):
    return dealer_no in BLOCKED_DEALER_NOS
```

**Note:** Keep in sync with `lib/blocked-dealers.ts`.

---

## Deleted Scripts (Historical)

52 scripts were deleted on January 13, 2026 as part of cleanup. These included:
- Migration scripts (one-time use)
- Import scripts (replaced by Excel sync)
- Validation scripts (replaced by dealer-review UI)
- Testing scripts (ad-hoc)

---

## Related Documentation

| File | Purpose |
|------|---------|
| [TYPESCRIPT_MODULES.md](TYPESCRIPT_MODULES.md) | TypeScript API implementation |
| [API_REFERENCE.md](API_REFERENCE.md) | API endpoints |
