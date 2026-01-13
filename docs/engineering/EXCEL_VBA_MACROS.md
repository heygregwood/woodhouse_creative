# Excel VBA Macros - Allied Air Integration

**Last Updated:** January 13, 2026
**File:** `Turnkey Social Media - Dealers - Current.xlsm`
**Location:** SharePoint OneDrive

---

## Overview

The Excel workbook is the **source of truth** for dealer data from Allied Air. It contains VBA macros that:
1. Pull new dealers from Allied Air's API
2. Push program status changes back to Allied Air
3. Send new dealer notifications to Google Apps Script for welcome emails

```
Allied Air API
    ↕ (VBA Macros)
Excel Workbook (SharePoint)
    ↓ (sync_from_excel.py - one way)
Firestore (woodhouse-creative-db)
    ↓
Dashboard / Automation
```

**Important:** Sync is ONE-WAY from Excel → Firestore. Changes made in the dashboard do NOT sync back to Excel.

---

## Worksheets

| Sheet | Purpose |
|-------|---------|
| `Woodhouse Data` | Main dealer list with program status |
| `Data From Allied Air API` | Raw data refreshed from Allied Air |
| `New Dealers` | Temporary sheet showing newly found dealers |
| `Removed Dealers` | Archive of dealers removed from Allied Air |
| `Activity Log` | Audit trail of all macro operations |

---

## Macro 1: FindNewDealers

**Purpose:** Sync dealers from Allied Air API, find new ones, remove departed ones

**What it does:**
1. Refreshes data connection to Allied Air API
2. Loops through `Data From Allied Air API` sheet
3. For each dealer with status `A` (Active) or `REN` (Renewal):
   - Searches `Woodhouse Data` column D for dealer number
   - If NOT found → New dealer:
     - Copies to `New Dealers` sheet
     - Copies to `Woodhouse Data` with status "NEW"
     - Logs event
     - (Disabled) Sends welcome email via Google Apps Script
4. Loops through `Woodhouse Data` looking for removed dealers:
   - Skips dealers with source "a la carte"
   - If dealer NOT in Allied Air data → Removed:
     - Moves row to `Removed Dealers` sheet
     - Logs event
5. Shows summary message

**Column Mapping (Allied Air API → Woodhouse Data):**
| Allied Column | Index | Field |
|---------------|-------|-------|
| A | 1 | Dealer Number |
| C | 3 | Distributor |
| D | 4 | Business Name |
| E | 5 | Status (A/REN/etc) |
| F | 6 | Is Armstrong Air (boolean) |
| G | 7 | Is Airease (boolean) |
| H | 8 | Tier Code (CTEAM/PREMR/PROAIR/PROARM) |
| K | 11 | Turnkey Email |
| L | 12 | Contact Full Name |
| M | 13 | Contact Email |

**Tier Mapping:**
| Code | Display Name |
|------|--------------|
| CTEAM | ComforTeam® |
| PREMR | Premier™ |
| PROAIR | ProTeam™ |
| PROARM | ProTeam™ |

**Brand Video Links:**
| Brand | Video URL |
|-------|-----------|
| Armstrong Air® | https://vimeo.com/910160703/51df1eb27d |
| Airease® | https://vimeo.com/914492643 |

---

## Workbook Event: BeforeClose

**Purpose:** Prompt user to sync changes back to Allied Air when closing Excel

**Code:**
```vba
Private Sub Workbook_BeforeClose(Cancel As Boolean)
    If (MsgBox("Do you wish to post updates to the Allied Air API database?", vbYesNo, "Post Updates?") = vbYes) Then
        Call PostProgramStatus
    End If
End Sub
```

**What it does:**
1. Fires when user closes the Excel workbook
2. Shows Yes/No dialog asking if they want to post updates
3. If Yes, calls `PostProgramStatus` macro to sync changes to Allied Air API
4. Ensures changes made in Excel get pushed back to Allied Air

---

## Macro 2: PostProgramStatus

**Purpose:** Push program status changes back to Allied Air API

**What it does:**
1. Reads `Woodhouse Data` sheet columns:
   - Column A: Program Status
   - Column B: (unknown - included in payload)
   - Column C: (unknown - included in payload)
   - Column D: Dealer Number
2. Builds comma-separated payload: `DealerNo:Status:Col3:Col2`
3. Validates all rows have a program status
4. POSTs to Azure Function: `https://turnkeyapiadaptor-prod.azurewebsites.net/api/SyncDealersFromExcel`
5. Logs result

**API Details:**
- **Endpoint:** `https://turnkeyapiadaptor-prod.azurewebsites.net/api/SyncDealersFromExcel`
- **Method:** POST
- **Headers:**
  - `Content-Type: multipart/form-data`
  - `Accept: application/xml`
  - `X-Functions-Key: 1OquXhXv4cwhQm2-u1Gmp76epybf7pN-pl0C-8--1YeSAzFuP-f_7g==`
- **Payload:** Comma-separated `DealerNo:Status:Col3:Col2` for each dealer

---

## Macro 3: NotifyMailMerge (Currently Disabled)

**Purpose:** Send new dealer info to Google Apps Script for welcome email

**Status:** Code exists but is commented out in `FindNewDealers`

**What it does:**
1. Builds JSON payload with dealer info
2. POSTs to Google Apps Script web app
3. Apps Script adds row to Google Sheet for Mail Merge

**Google Apps Script Details:**
- **URL:** `https://script.google.com/macros/s/AKfycbzluH8wBZvQKz6B1IWgOCa9z0gEcS8EGxZwjfMSpbPXqGwMkqAUBuXkxdCzuEbJtIcp/exec`
- **Secret:** Shared secret for authentication
- **Payload Fields:** Brand, Distributor, BusinessName, FirstName, LastName, Tier, VideoLink, EmailAddress, FileAttachment

---

## Program Status Workflow

### CONTENT → FULL
**Trigger:** Dealer accepts Facebook admin invite
**Detection:** Email to communitymanagers@woodhousesocial.com (sometimes unreliable - FB bug)
**Alternative Detection:** Check Facebook Pages sidebar → Notifications
**Action:** Manually update Excel column A from "CONTENT" to "FULL", then run PostProgramStatus

### FULL → CONTENT
**Trigger:** Dealer revokes Facebook admin access
**Detection:** Only noticed when trying to schedule posts and access is denied
**Action:** Manually update Excel column A from "FULL" to "CONTENT", then run PostProgramStatus

---

## Data Flow Implications

### What This Means for Firestore

1. **New Dealers:** Added to Excel by `FindNewDealers` macro → sync to Firestore via `sync_from_excel.py`

2. **Removed Dealers:** Moved to `Removed Dealers` sheet by macro → sync script should detect missing dealers and mark as removed in Firestore (currently may leave orphans)

3. **Status Changes:** Updated in Excel manually → sync to Firestore via `sync_from_excel.py`

4. **Creatomate Fields:** Only exist in Firestore (logo, phone, website, display_name) → NOT synced back to Excel

### Potential Issues

1. **Orphaned Firestore Records:** If `sync_from_excel.py` doesn't handle removals, dealers removed from Excel stay in Firestore forever

2. **Dashboard Edits Overwritten:** If someone edits contact info in dashboard, next Excel sync overwrites it

3. **Status Mismatch:** If status changed in dashboard but not Excel, they get out of sync

### Recommendations

1. **Sync script should handle removals:** Mark Firestore dealers as `removed` if not in Excel
2. **Dashboard should be read-only for Excel fields:** Or clearly warn that edits won't persist
3. **Consider two-way sync for status:** Or document that Excel is always authoritative

---

## Related Files

- `scripts/sync_from_excel.py` - Reads Excel, syncs to Firestore
- `docs/engineering/EXCEL_SYNC_REFERENCE.md` - Column mapping details
- `lib/firestore-dealers.ts` - Firestore operations

---

## Secrets (DO NOT COMMIT)

The VBA code contains API keys and secrets that should be kept confidential:
- Azure Function key for Allied Air API
- Google Apps Script secret for mail merge

These are stored in the Excel file itself, not in this codebase.
