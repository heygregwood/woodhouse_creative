# Documentation Improvement Plan for Woodhouse Creative

**Purpose:** Prevent documentation drift and reduce errors like the Excel sync column mapping bug
**Analysis Date:** January 9, 2026
**Based on:** Patterns from woodhouse_social repository

---

## Executive Summary

**Problem:** The Excel sync bug (331 dealers incorrectly marked as removed) was caused by documentation drift. The code had `dealer_no` at column index 3, but documentation implied it was at index 0. Nobody caught this because there was no mandatory process to verify code matches documentation.

**Solution:** Implement 3 critical patterns from woodhouse_social:
1. **3-Step Documentation Workflow** (mandatory before commits)
2. **Verification Dates & Cross-References** (shows docs match current code)
3. **Granular Changelog with File References** (exact audit trail)

**Impact:** These patterns will catch drift before it causes bugs and make documentation trustworthy.

---

## Pattern 1: Mandatory Documentation Workflow

### Add to CLAUDE.md (Top Section - Line 20)

```markdown
## DOCUMENTATION VERIFICATION (PREVENTS DRIFT)

**MANDATORY WORKFLOW - NO EXCEPTIONS:**

Before committing ANY changes that touch data structures, databases, or column mappings:

1. **Identify what changed:**
   - Which code files were modified?
   - Which data structures/schemas/mappings are affected?

2. **Find corresponding docs:**
   - Search `docs/` for references to the changed structure
   - Check DATABASE.md, DATA_ARCHITECTURE.md, API docs
   - Check CLAUDE.md for workflow/process changes

3. **Read code → Read docs → Compare:**
   - Read the ACTUAL code to see current state
   - Read the ACTUAL docs to see what's documented
   - Identify specific deltas (what's missing, outdated, wrong)

4. **Make targeted edits:**
   - Update docs with specific changes (not wholesale rewrites)
   - Add verification date: `**Last Updated:** YYYY-MM-DD`
   - Add code references: Line numbers, file paths

5. **Spot-check verification:**
   - Pick a random value from code (e.g., column index 3)
   - Find it in docs
   - If not there or different: FIX BEFORE COMMITTING

6. **Update CHANGELOG.md:**
   - List exact files changed
   - Note data structure changes explicitly

**NEVER:**
- Update docs based on assumptions about what was built
- Make wholesale doc rewrites without reading code first
- Skip the comparison step
- Commit without updating CHANGELOG.md

**Example of what this prevents:**
The Excel sync bug happened because column mapping changed in code but docs weren't updated. This workflow would have caught it in step 3 (compare code vs docs).
```

---

## Pattern 2: Verification Dates & Cross-References

### Update All Critical Documentation Files

Add these headers to every data structure document:

**Example for DATABASE.md:**

```markdown
# Database Schema

**Last Updated:** January 9, 2026
**Schema Verification:** Verified against SQLite database on January 9, 2026
**Excel Sync Verification:** Verified column mappings match lib/sync-excel.ts on January 9, 2026

---
```

**Example for DATA_ARCHITECTURE.md:**

```markdown
# Data Architecture

**Last Updated:** January 9, 2026
**Firestore Verification:** Verified against production Firestore on January 9, 2026

---
```

### Benefits:
- Shows document freshness at a glance
- Verification statements provide trust that docs match reality
- If verification date is old (>30 days), docs might be stale

---

## Pattern 3: Excel Column Mapping Documentation (Critical)

### Create: `docs/EXCEL_SYNC_REFERENCE.md`

```markdown
# Excel Sync Column Mapping Reference

**Last Updated:** January 9, 2026
**Code Reference:** `lib/sync-excel.ts` lines 82-113
**Excel File:** `Turnkey Social Media - Dealers - Current.xlsm` (OneDrive)
**Last Verified:** January 9, 2026 - Manually checked against actual Excel file

---

## Purpose

This document maps Excel columns to database fields. **CRITICAL:** Any change to column indices in code MUST be reflected here immediately.

---

## Column Mapping Table

| Excel Column | Index | Field Name | Data Type | Purpose | Code Reference |
|--------------|-------|-----------|-----------|---------|----------------|
| A | 0 | `program_status` | string | CONTENT/FULL/NEW | `sync-excel.ts:85` |
| B | 1 | `first_post_date` | string | Date dealer started | `sync-excel.ts:86` |
| C | 2 | `source` | string | Origin (Allied/Other) | `sync-excel.ts:87` |
| **D** | **3** | **`dealer_no`** | string | **Primary key** | `sync-excel.ts:88` |
| E | 4 | `date_added` | string | When added to program | `sync-excel.ts:89` |
| F | 5 | `distributor_name` | string | Branch name | `sync-excel.ts:90` |
| G | 6 | `dealer_name` | string | Business legal name | `sync-excel.ts:91` |
| H | 7 | `allied_status` | string | Active/Inactive | `sync-excel.ts:92` |
| I | 8 | `armstrong_air` | number | 1 if sells brand | `sync-excel.ts:93` |
| J | 9 | `airease` | number | 1 if sells brand | `sync-excel.ts:94` |
| K | 10 | `tier` | string | Tier level | `sync-excel.ts:95` |
| L | 11 | `turnkey_phone` | string | Contact phone | `sync-excel.ts:96` |
| M | 12 | `turnkey_url` | string | Website URL | `sync-excel.ts:97` |
| N | 13 | `turnkey_email` | string | Contact email | `sync-excel.ts:98` |
| O | 14 | `contact_name` | string | Full name | `sync-excel.ts:99` |
| P | 15 | `contact_email` | string | Email | `sync-excel.ts:100` |
| Q | 16 | `contact_phone` | string | Phone | `sync-excel.ts:101` |
| R | 17 | `contact_admin_email` | string | Admin email | `sync-excel.ts:102` |
| S | 18 | `dealer_address` | string | Street address | `sync-excel.ts:103` |
| T | 19 | `dealer_city` | string | City | `sync-excel.ts:104` |
| U | 20 | `dealer_state` | string | State | `sync-excel.ts:105` |
| V | 21 | `dealer_web_address` | string | Website | `sync-excel.ts:106` |
| W | 22 | `registration_date` | string | Sign-up date | `sync-excel.ts:107` |
| X | 23 | `renew_date` | string | Renewal date | `sync-excel.ts:108` |
| Y | 24 | `note` | string | Notes | `sync-excel.ts:109` |
| Z | 25 | `has_sprout_excel` | number | 1 if in Sprout | `sync-excel.ts:110` |
| AA | 26 | `bad_email` | number | 1 if email bounced | `sync-excel.ts:111` |
| AB | 27 | `contact_first_name` | string | First name | `sync-excel.ts:112` |

---

## Critical Index: Dealer Number

**IMPORTANT:** `dealer_no` is at **column D (index 3)**, NOT column A.

**Why this matters:**
- In Excel, column A is the first visible column
- But it contains `program_status`, not `dealer_no`
- The parser uses **0-based indexing**: Column D = Index 3
- A previous bug incorrectly used index 0, causing parser to read "CONTENT"/"FULL" as dealer numbers

**Verification:**
```typescript
// From lib/sync-excel.ts line 88
dealer_no: 3,   // D: Dealer No
```

---

## How to Verify This Document

1. **Open the Excel file** (OneDrive path above)
2. **Check header row** - Column D should say "Dealer No"
3. **Open `lib/sync-excel.ts`**
4. **Compare line 88** - Should have `dealer_no: 3,`
5. **If they don't match:** Update this doc AND code, then verify

---

## Change History

| Date | Change | Files Updated | Updated By |
|------|--------|---------------|------------|
| 2026-01-09 | Fixed dealer_no from index 0 to 3 | `lib/sync-excel.ts`, this doc | Greg/Claude |

---

## Common Errors to Avoid

❌ **Don't assume column A = index 0 = dealer_no**
✅ **Always check the actual Excel header row**

❌ **Don't change indices in code without updating this doc**
✅ **Update both code and docs in same commit**

❌ **Don't trust old screenshots or memory**
✅ **Open the actual file and verify**
```

---

## Pattern 4: Granular Changelog Format

### Update CHANGELOG.md with Structured Format

**Current CHANGELOG.md** lacks detail. Update to woodhouse_social format:

```markdown
# Changelog

All notable changes to woodhouse_creative are documented here.

Format: `[Date] - [Feature/Fix Name]`

---

## [2026-01-09] - Excel Sync Column Mapping Fix

### Fixed
- fix: Excel sync reading wrong column for dealer_no
  - **Issue:** Parser read column A (program_status) instead of column D (dealer_no)
  - **Root cause:** COLUMN_INDICES had `dealer_no: 0` instead of `dealer_no: 3`
  - **Files changed:**
    - `lib/sync-excel.ts` - Updated COLUMN_INDICES (lines 82-113)
    - `docs/EXCEL_SYNC_REFERENCE.md` - Created comprehensive mapping doc
    - `docs/DATABASE.md` - Updated Excel column references
  - **Impact:** 331 dealers incorrectly flagged as removed (now fixed)
  - **Verification:** Dry run sync shows 340 unchanged, 0 new, 0 removed

### Added
- docs: Excel sync column mapping reference
  - New file: `docs/EXCEL_SYNC_REFERENCE.md`
  - Includes full column table with code line references
  - Prevents future column mapping bugs

---

## [2026-01-08] - Database Restoration After Erroneous Sync

### Fixed
- fix: Restored 331 dealers incorrectly removed by sync
  - **Method:** Temporarily disabled welcome emails, ran corrected sync
  - **Files changed:**
    - `app/api/admin/sync-excel/route.ts` - Commented out email code (lines 67-88)
    - Later re-enabled after restoration complete
  - **Result:** Database restored to 340 dealers (correct state)

---

## Template for Future Entries

## [YYYY-MM-DD] - [Feature/Fix Name]

### Added / Changed / Fixed / Removed
- [type]: [Brief description]
  - **Issue:** [What was wrong] (if applicable)
  - **Root cause:** [Why it happened] (if applicable)
  - **Files changed:**
    - `path/to/file.ts` - [What changed, line numbers if significant]
    - `docs/file.md` - [Section updated]
  - **Impact:** [How this affects system]
  - **Verification:** [How to verify it works]
```

---

## Pattern 5: Documentation Index (Navigation Hub)

### Create: `docs/README.md`

```markdown
# Woodhouse Creative Documentation

**Last Updated:** January 9, 2026

This directory contains all documentation for the Woodhouse Creative automation system.

---

## Quick Links by Task

| Task | Document |
|------|----------|
| Understanding the codebase | [CLAUDE.md](../CLAUDE.md) |
| Database schema and fields | [DATABASE.md](DATABASE.md) |
| Data model overview | [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md) |
| Current manual workflow | [WORKFLOW_CURRENT.md](WORKFLOW_CURRENT.md) |
| Automation roadmap | [END_TO_END_DOCUMENTATION_DRAFT.md](END_TO_END_DOCUMENTATION_DRAFT.md) |
| Excel sync column mapping | [EXCEL_SYNC_REFERENCE.md](EXCEL_SYNC_REFERENCE.md) |
| Compliance guidelines | [COMPLIANCE_GUIDE.md](COMPLIANCE_GUIDE.md) |
| Dealer onboarding automation | [DEALER_ONBOARDING_AUTOMATION_PLAN.md](DEALER_ONBOARDING_AUTOMATION_PLAN.md) |

---

## Documentation by Category

### Core System
- **CLAUDE.md** - AI assistant instructions, dev workflow, coding standards
- **DATABASE.md** - SQLite schema, field definitions, import scripts
- **DATA_ARCHITECTURE.md** - High-level data model, Excel structure
- **EXCEL_SYNC_REFERENCE.md** - ⚠️ Critical: Column mapping reference

### Workflows & Processes
- **WORKFLOW_CURRENT.md** - Current 9-step manual post creation process
- **END_TO_END_DOCUMENTATION_DRAFT.md** - Complete automation implementation plan
- **DEALER_ONBOARDING_AUTOMATION_PLAN.md** - Automated dealer review workflow

### Compliance & Standards
- **COMPLIANCE_GUIDE.md** - General compliance guidelines
- **COMPLIANCE_WOODHOUSE_CREATIVE.md** - Project-specific compliance
- **DEALER_NAMES.md** - Naming conventions and standards

---

## Critical Documents (Read First)

If you're new to the project, read these in order:

1. **CLAUDE.md** - Start here for dev workflow and mandatory rules
2. **DATA_ARCHITECTURE.md** - Understand the data model
3. **DATABASE.md** - Learn the database schema
4. **EXCEL_SYNC_REFERENCE.md** - ⚠️ Critical for Excel sync work

---

## Verification Dates

Documents with verification dates show when they were last checked against live code/data:

| Document | Last Verified | Against |
|----------|---------------|---------|
| DATABASE.md | 2026-01-09 | SQLite database |
| EXCEL_SYNC_REFERENCE.md | 2026-01-09 | lib/sync-excel.ts + Excel file |
| DATA_ARCHITECTURE.md | 2026-01-09 | Firestore schema |

If a verification date is >30 days old, the document may need updating.
```

---

## Pattern 6: Code Reference Format Standards

### Standard Format for File References

**Always use:**
- Full paths from repo root: `lib/sync-excel.ts` (not `../sync-excel.ts`)
- Line number ranges: `lines 82-113` (for significant blocks)
- Specific line numbers: `line 88` (for critical single lines)
- Searchable format: `sync-excel.ts:88` (grep-friendly)

**Example in docs:**

```markdown
The dealer number field is parsed at column index 3:

**Code Reference:** [lib/sync-excel.ts:88](../lib/sync-excel.ts#L88)

```typescript
dealer_no: 3,   // D: Dealer No
```

This ensures anyone can verify the documentation by checking the code.
```

---

## Pattern 7: Data Structure Documentation Template

### Template for All Data Structures

```markdown
## [Structure Name] (e.g., "Dealers Table" or "Excel Row Format")

**Last Updated:** YYYY-MM-DD
**Verified Against:** [Source - e.g., "SQLite database", "Excel file", "Firestore collection"]
**Code Reference:** [file.ts:line-line]

### Fields

| Field Name | Type | Required | Default | Description | Code Reference |
|------------|------|----------|---------|-------------|----------------|
| `field_name` | string | Yes | null | Purpose of field | `file.ts:123` |
| `another_field` | number | No | 0 | Another purpose | `file.ts:124` |

### Valid Values

For enum fields, list all valid values:

| Field | Valid Values | Meaning |
|-------|--------------|---------|
| `program_status` | `CONTENT` | We create content, they post |
| | `FULL` | We have admin access, we post |
| | `NEW` | Just onboarded, pending setup |

### Example

```json
{
  "field_name": "value",
  "another_field": 123
}
```

### Common Errors

❌ **Don't** [common mistake]
✅ **Do** [correct approach]
```

---

## Implementation Checklist

### Phase 1: Update CLAUDE.md (Immediate)

- [ ] Add "Documentation Verification" section at line 20
- [ ] Include mandatory 3-step workflow
- [ ] Add examples of what this prevents (Excel sync bug)
- [ ] Set verification requirement before commits

### Phase 2: Create Critical Reference Docs (Week 1)

- [ ] Create `docs/EXCEL_SYNC_REFERENCE.md` with full column table
- [ ] Create `docs/README.md` as documentation index
- [ ] Update `docs/DATABASE.md` with verification date header
- [ ] Update `docs/DATA_ARCHITECTURE.md` with verification date header

### Phase 3: Update CHANGELOG.md (Week 1)

- [ ] Add structured format with file references
- [ ] Document the Excel sync bug fix (template above)
- [ ] Document database restoration
- [ ] Add template for future entries

### Phase 4: Add Verification Dates (Week 2)

- [ ] Add verification headers to all existing docs
- [ ] Run verification check: Compare docs vs code
- [ ] Update any mismatches found
- [ ] Set calendar reminder to verify monthly

### Phase 5: Create Documentation Standards (Week 2)

- [ ] Add code reference format standards to CLAUDE.md
- [ ] Create data structure documentation template
- [ ] Document verification process in CLAUDE.md

---

## Success Metrics

**How to measure improvement:**

1. **Bug Prevention:** Zero column mapping bugs in next 6 months
2. **Freshness:** All docs have verification dates <30 days old
3. **Completeness:** Every data structure change has corresponding doc update
4. **Auditability:** CHANGELOG.md lists exact files changed for every commit
5. **Discoverability:** Developers can find relevant docs in <30 seconds via README.md index

---

## Maintenance Plan

### Monthly Verification (1st of each month)

1. **Check verification dates** - Which docs are >30 days old?
2. **Run spot checks:**
   - Pick 3 random fields from DATABASE.md
   - Verify they match SQLite schema
   - If mismatch: Update docs
3. **Review CHANGELOG.md** - Did all recent commits get logged?
4. **Update verification dates** on checked docs

### Pre-Commit Verification (Every commit)

1. **Identify changed data structures** - What changed?
2. **Find corresponding docs** - Which docs reference it?
3. **Read code → Read docs → Compare** - Do they match?
4. **Update docs if needed** - Fix before committing
5. **Update CHANGELOG.md** - Log the change with file references

---

## Appendix: Lessons from Excel Sync Bug

### What Went Wrong

1. **Code changed** (`dealer_no: 0` → `dealer_no: 3`)
2. **Docs not updated** (no reference to column indices)
3. **No verification process** (nobody caught the mismatch)
4. **Result:** 331 dealers incorrectly flagged as removed

### What Would Have Prevented It

| Pattern | How It Helps |
|---------|--------------|
| **3-Step Workflow** | Step 3 (compare code vs docs) would have caught the mismatch |
| **Verification Dates** | Old verification date signals docs might be stale |
| **EXCEL_SYNC_REFERENCE.md** | Explicit column table makes mapping auditable |
| **CHANGELOG.md with files** | Log would show sync-excel.ts changed but no doc update |
| **Code references** | Docs would link to `sync-excel.ts:88`, making verification easy |

### Root Cause

**Documentation was treated as optional**, not as part of the code. The fix is to **make documentation verification mandatory** before commits, just like tests.

---

## Questions & Feedback

**Questions about this plan?** Ask in this session.

**Found a doc/code mismatch?** Update both and log in CHANGELOG.md.

**Suggestions for improvement?** This plan should evolve based on what works.
