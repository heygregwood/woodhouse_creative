# Spreadsheet System

**Last Updated:** January 13, 2026
**Spreadsheet ID:** `1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY`

---

## Overview

The scheduling spreadsheet is the operational hub for post scheduling. It stores dealer columns with metadata, post rows with copy, and tracks workflow status.

---

## Spreadsheet Structure

### Columns

| Column | Content |
|--------|---------|
| A | Post number (13+) |
| B | Post metadata |
| C | Base copy (template) |
| D | (Reserved) |
| E | (Reserved) |
| F | Reference/test |
| G+ | Dealer columns |

### Row Structure (Per Dealer Column)

| Row | Field | Source | Editable |
|-----|-------|--------|----------|
| 1 | Dealer Number | System | No |
| 2 | Status | Olivia | Yes |
| 3 | Last Post Date | Olivia | Yes |
| 4 | Who Posted | Olivia | Yes |
| 5 | First Name | Database | Auto |
| 6 | Email | Database | Auto |
| 7 | Region | Database | Auto |
| 8 | Website | Database | Auto |
| 9 | Phone | Database | Auto |
| 10 | Distributor | Database | Auto |
| 11 | Display Name | Database | Auto |
| 12 | (Header) | - | - |
| 13+ | Post Copy | System | Auto |

---

## Row 2 Status Values

| Status | Meaning |
|--------|---------|
| Pending | Dealer needs scheduling |
| Done | Posts scheduled, awaiting email |
| Email Sent | Notification sent |

---

## Variable Substitution

Base copy in column C contains placeholders:

| Variable | Source | Example |
|----------|--------|---------|
| `{name}` | `display_name` | "Wiesbrook Sheet Metal" |
| `{phone}` | `creatomate_phone` | "630-555-1234" |
| `{website}` | `creatomate_website` | "wsminc.net" |

**Example Base Copy:**
```
Call {name} today at {phone} for all your heating and cooling needs!
Visit {website} to learn more.
```

**Example Personalized (Column G):**
```
Call Wiesbrook Sheet Metal today at 630-555-1234 for all your heating and cooling needs!
Visit wsminc.net to learn more.
```

---

## Populating Post Copy

### Via Dashboard (Preferred)

1. Navigate to `/admin`
2. Enter post number
3. Type base copy in text area
4. Click {name}, {phone}, {website} buttons to insert variables
5. Click "Preview" to verify
6. Click "Populate All" to write

### Via API

```bash
# Preview
curl "https://woodhouse-creative.vercel.app/api/admin/populate-post-copy?post_number=700&preview=true"

# Apply
curl -X POST "https://woodhouse-creative.vercel.app/api/admin/populate-post-copy" \
  -H "Content-Type: application/json" \
  -d '{"post_number": 700, "base_copy": "Call {name} at {phone}!"}'
```

### Via Python

```bash
python3 scripts/populate_post_copy.py --post 700 --copy "Call {name} at {phone}!"
```

---

## Adding New Dealer Columns

### Automatic (Post-Approval)

When a dealer is approved via `/admin/dealer-review`:
1. System calls `addDealerColumn()` in google-sheets.ts
2. Finds next available column
3. Populates rows 1-11 with dealer data
4. Populates rows 13+ with existing post copy

### Manual

```bash
python3 scripts/add_dealer_to_spreadsheet.py 10251015
```

---

## Syncing Dealer Data

Rows 5-11 are synced from database to spreadsheet.

### Via Script

```bash
python3 scripts/sync_spreadsheet.py --sync-dealers
```

### What Gets Synced

| Row | Field | Source |
|-----|-------|--------|
| 5 | First Name | `contact_first_name` |
| 6 | Email | `contact_email` |
| 7 | Region | `region` |
| 8 | Website | `creatomate_website` |
| 9 | Phone | `creatomate_phone` |
| 10 | Distributor | `distributor_name` |
| 11 | Display Name | `display_name` |

---

## Post Archive Spreadsheet

**ID:** `1-lhgjbNL1QBFNLZ5eSQSdaJTwIX0JKfE`

Stores all approved posts (656+ as of January 2026).

### Columns

| Column | Field |
|--------|-------|
| A | Post # |
| B | Season |
| C | Post Copy |
| D | Image |
| E | Subject Matter |
| F-H | Tags |
| I | Notes |
| J | Comments |
| K | AAE Approved |

---

## Workflow

### Olivia's Workflow

1. Check spreadsheet for FULL dealers
2. Select posts for scheduling
3. Schedule in Sprout Social
4. Mark Row 2 as "Done"
5. System sends email, updates to "Email Sent"

### Automation Workflow

1. New posts rendered for all FULL dealers
2. Populate post copy to spreadsheet
3. Olivia schedules
4. Mark as "Done"
5. `/api/admin/process-done` sends emails

---

## Finding Dealer Column

```typescript
import { getDealerColumn } from '@/lib/google-sheets';

const column = await getDealerColumn('10251015');
// Returns: 'G' or 'AH' etc.
```

---

## Troubleshooting

### Dealer Not in Spreadsheet

1. Check dealer is FULL and approved
2. Run add_dealer_to_spreadsheet.py
3. Or re-approve via dealer-review

### Copy Not Populated

1. Verify base copy has correct variables
2. Check dealer has creatomate_phone, creatomate_website
3. Run populate command again

### Status Not Updating

1. Check dealer column exists
2. Verify Google Sheets API permissions
3. Check for errors in API logs

---

## Related Documentation

| File | Purpose |
|------|---------|
| [EMAIL_AUTOMATION.md](EMAIL_AUTOMATION.md) | Email sending after "Done" |
| [ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md) | Populate post copy UI |
| [../engineering/TYPESCRIPT_MODULES.md](../engineering/TYPESCRIPT_MODULES.md) | google-sheets.ts |
