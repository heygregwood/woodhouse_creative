# Excel Sync Column Mapping Reference

**Last Updated:** January 9, 2026
**Code Reference:** [lib/sync-excel.ts](../lib/sync-excel.ts) lines 82-113
**Excel File:** `Turnkey Social Media - Dealers - Current.xlsm` (OneDrive)
**SharePoint Path:** `/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database/`
**Last Verified:** January 9, 2026 - Manually checked against actual Excel file

---

## Purpose

This document maps Excel columns to database fields for the dealer sync process. **CRITICAL:** Any change to column indices in code MUST be reflected here immediately to prevent sync bugs.

---

## Column Mapping Table

| Excel Column | Index | Field Name | Data Type | Purpose | Code Reference |
|--------------|-------|-----------|-----------|---------|----------------|
| A | 0 | `program_status` | string | CONTENT/FULL/NEW | [sync-excel.ts:85](../lib/sync-excel.ts#L85) |
| B | 1 | `first_post_date` | string | Date dealer started | [sync-excel.ts:86](../lib/sync-excel.ts#L86) |
| C | 2 | `source` | string | Origin (Allied/Other) | [sync-excel.ts:87](../lib/sync-excel.ts#L87) |
| **D** | **3** | **`dealer_no`** | string | **Primary key (8-digit ID)** | [sync-excel.ts:88](../lib/sync-excel.ts#L88) |
| E | 4 | `date_added` | string | When added to program | [sync-excel.ts:89](../lib/sync-excel.ts#L89) |
| F | 5 | `distributor_name` | string | Branch name | [sync-excel.ts:90](../lib/sync-excel.ts#L90) |
| G | 6 | `dealer_name` | string | Business legal name | [sync-excel.ts:91](../lib/sync-excel.ts#L91) |
| H | 7 | `allied_status` | string | Active/Inactive | [sync-excel.ts:92](../lib/sync-excel.ts#L92) |
| I | 8 | `armstrong_air` | number | 1 if sells Armstrong Air | [sync-excel.ts:93](../lib/sync-excel.ts#L93) |
| J | 9 | `airease` | number | 1 if sells AirEase | [sync-excel.ts:94](../lib/sync-excel.ts#L94) |
| K | 10 | `tier` | string | Tier level | [sync-excel.ts:95](../lib/sync-excel.ts#L95) |
| L | 11 | `turnkey_phone` | string | Contact phone | [sync-excel.ts:96](../lib/sync-excel.ts#L96) |
| M | 12 | `turnkey_url` | string | Website URL | [sync-excel.ts:97](../lib/sync-excel.ts#L97) |
| N | 13 | `turnkey_email` | string | Contact email | [sync-excel.ts:98](../lib/sync-excel.ts#L98) |
| O | 14 | `contact_name` | string | Full name | [sync-excel.ts:99](../lib/sync-excel.ts#L99) |
| P | 15 | `contact_email` | string | Email | [sync-excel.ts:100](../lib/sync-excel.ts#L100) |
| Q | 16 | `contact_phone` | string | Phone | [sync-excel.ts:101](../lib/sync-excel.ts#L101) |
| R | 17 | `contact_admin_email` | string | Admin email | [sync-excel.ts:102](../lib/sync-excel.ts#L102) |
| S | 18 | `dealer_address` | string | Street address | [sync-excel.ts:103](../lib/sync-excel.ts#L103) |
| T | 19 | `dealer_city` | string | City | [sync-excel.ts:104](../lib/sync-excel.ts#L104) |
| U | 20 | `dealer_state` | string | State | [sync-excel.ts:105](../lib/sync-excel.ts#L105) |
| V | 21 | `dealer_web_address` | string | Website | [sync-excel.ts:106](../lib/sync-excel.ts#L106) |
| W | 22 | `registration_date` | string | Sign-up date | [sync-excel.ts:107](../lib/sync-excel.ts#L107) |
| X | 23 | `renew_date` | string | Renewal date | [sync-excel.ts:108](../lib/sync-excel.ts#L108) |
| Y | 24 | `note` | string | Notes | [sync-excel.ts:109](../lib/sync-excel.ts#L109) |
| Z | 25 | `has_sprout_excel` | number | 1 if in Sprout | [sync-excel.ts:110](../lib/sync-excel.ts#L110) |
| AA | 26 | `bad_email` | number | 1 if email bounced | [sync-excel.ts:111](../lib/sync-excel.ts#L111) |
| AB | 27 | `contact_first_name` | string | First name | [sync-excel.ts:112](../lib/sync-excel.ts#L112) |

---

## Critical Index: Dealer Number

**IMPORTANT:** `dealer_no` is at **column D (index 3)**, NOT column A.

**Why this matters:**
- In Excel, column A is the first visible column
- But it contains `program_status` (CONTENT/FULL/NEW), not `dealer_no`
- The parser uses **0-based indexing**: Column D = Index 3
- **Previous bug (Jan 2026):** Code incorrectly had `dealer_no: 0`, causing parser to read "CONTENT"/"FULL"/"NEW" as dealer numbers, flagging 331 dealers as removed

**Verification:**
```typescript
// From lib/sync-excel.ts line 88
dealer_no: 3,   // D: Dealer No
```

---

## How to Verify This Document

1. **Open the Excel file** on OneDrive (path above)
2. **Check header row** - Column D should say "Dealer No"
3. **Open** [lib/sync-excel.ts](../lib/sync-excel.ts)
4. **Compare line 88** - Should have `dealer_no: 3,`
5. **If they don't match:** Update this doc AND code, then verify again

**Quick verification command:**
```bash
grep -n "dealer_no:" lib/sync-excel.ts
# Should show: 88:  dealer_no: 3,
```

---

## Change History

| Date | Change | Files Updated | Reason |
|------|--------|---------------|--------|
| 2026-01-09 | Fixed `dealer_no` from index 0 to 3 | `lib/sync-excel.ts`, this doc | Bug fix: parser reading wrong column |
| 2026-01-09 | Created this reference doc | New file | Prevent future column mapping bugs |

---

## Common Errors to Avoid

❌ **Don't assume column A = index 0 = dealer_no**
✅ **Always check the actual Excel header row**

❌ **Don't change indices in code without updating this doc**
✅ **Update both code and docs in same commit**

❌ **Don't trust old screenshots or memory**
✅ **Open the actual file and verify**

❌ **Don't use 1-based indexing (Excel uses letters, code uses 0-based numbers)**
✅ **Column A = index 0, Column D = index 3**

---

## Related Documentation

- [DATABASE.md](DATABASE.md) - Database schema and field definitions
- [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md) - Overall data model
- [lib/sync-excel.ts](../lib/sync-excel.ts) - Implementation code
- [CHANGELOG.md](../CHANGELOG.md) - History of changes

---

## Testing Verification

To verify column mapping is correct:

```bash
# 1. Run dry-run sync
npm run dev
# Then visit http://localhost:3000/admin
# Click "Sync from Excel" - should show 340 unchanged, 0 new, 0 removed

# 2. Check logs for correct dealer numbers
# Should see dealer numbers like "10122026", not status values like "CONTENT"
```

If you see "CONTENT", "FULL", or "NEW" as dealer numbers in logs, the column mapping is wrong.
