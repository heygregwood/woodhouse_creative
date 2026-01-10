# Changelog

All notable changes to Woodhouse Creative are documented here.

**Format:** `[YYYY-MM-DD] - [Feature/Fix Name]`

---

## [2026-01-09] - Documentation Improvement Implementation

### Added
- docs: Comprehensive documentation improvement system
  - **New file:** `docs/DOCUMENTATION_IMPROVEMENT_PLAN.md` - Full improvement plan based on woodhouse_social patterns
  - **New file:** `docs/EXCEL_SYNC_REFERENCE.md` - Complete Excel column mapping table with code references
  - **New file:** `docs/README.md` - Documentation navigation index
  - **New file:** `CHANGELOG.md` - This file, structured changelog with file references
  - **Impact:** Prevents documentation drift that caused Excel sync bug

### Changed
- docs: Enhanced documentation verification workflow
  - **File:** `CLAUDE.md` (lines 35-77) - Expanded mandatory documentation workflow
  - **Added:** 6-step verification process before commits
  - **Added:** Spot-check verification requirement
  - **Added:** CHANGELOG.md update requirement
  - **Added:** Real example of Excel sync bug and how workflow prevents it
  - **Impact:** Makes documentation updates mandatory, preventing code/doc mismatches

---

## [2026-01-09] - Excel Sync Column Mapping Fix

### Fixed
- fix: Excel sync reading wrong column for dealer_no
  - **Issue:** Parser read column A (program_status) instead of column D (dealer_no)
  - **Root cause:** COLUMN_INDICES had `dealer_no: 0` instead of `dealer_no: 3`
  - **Files changed:**
    - `lib/sync-excel.ts` (lines 82-113) - Updated COLUMN_INDICES mapping
    - `docs/DATABASE.md` - Updated Excel column references (if present)
  - **Impact:** 331 dealers incorrectly flagged as removed, now fixed
  - **Verification:** Dry run sync shows 340 unchanged, 0 new, 0 removed
  - **Test:** Successfully synced without errors on 2026-01-09

---

## [2026-01-08] - Database Restoration After Erroneous Sync

### Fixed
- fix: Restored 331 dealers incorrectly removed by sync
  - **Method:** Temporarily disabled welcome emails, ran corrected sync
  - **Files changed:**
    - `app/api/admin/sync-excel/route.ts` (lines 67-88) - Commented out email code temporarily
    - Later: Re-enabled after restoration complete
  - **Result:** Database restored to 340 dealers (correct state)
  - **Verification:** Checked Firestore, confirmed all dealers present

---

## [2026-01-08] - Pending Review Alert Enhancement

### Fixed
- fix: Include new FULL dealers in pending review count
  - **Issue:** Dashboard alert only showed promoted dealers (CONTENT→FULL), not new dealers added as FULL
  - **Files changed:**
    - `app/api/admin/sync-excel/route.ts` (lines 104-111) - Added check for new FULL dealers
  - **Impact:** Yellow "Review Required" alert now shows for all dealers needing review
  - **Verification:** Tested with new FULL dealer, alert appeared correctly

---

## [2026-01-08] - Excel Sync TypeScript Type Fixes

### Fixed
- fix: TypeError handling dealer.changes as objects
  - **Issue:** Code called `.includes()` on change objects instead of strings
  - **Files changed:**
    - `app/admin/page.tsx` (line 531) - Fixed to access `change.field`, `change.old`, `change.new` properties
    - `app/admin/page.tsx` (line 553) - Fixed change display to show object properties
    - `app/admin/page.tsx` (lines 15-19) - Added `FieldChange` interface
    - `app/admin/page.tsx` (line 24) - Updated `SyncChanges` to use `FieldChange[]`
  - **Impact:** Eliminated TypeError during sync operations
  - **Verification:** TypeScript build passed, sync operations work correctly

---

## [Earlier] - Database Migration from SQLite to Firestore

### Changed
- refactor: Migrated primary database from SQLite to Firestore
  - **Files changed:** Multiple (migration was complex)
  - **Impact:** Firestore is now source of truth, SQLite read-only for batch renders
  - **Note:** Full migration details need to be documented

---

## Template for Future Entries

```markdown
## [YYYY-MM-DD] - [Feature/Fix Name]

### Added / Changed / Fixed / Removed
- [type]: [Brief description]
  - **Issue:** [What was wrong] (if applicable)
  - **Root cause:** [Why it happened] (if applicable)
  - **Files changed:**
    - `path/to/file.ts` (lines XX-YY) - [What changed]
    - `docs/file.md` (section name) - [What updated]
  - **Impact:** [How this affects system]
  - **Verification:** [How to verify it works]
  - **Test:** [What test was performed] (if applicable)
```

---

## Guidelines for CHANGELOG Updates

**When to add an entry:**
- Any change to data structures, schemas, or column mappings
- New features or significant functionality changes
- Bug fixes that affect system behavior
- Documentation updates for critical docs
- Database migrations or schema changes

**What to include:**
- **Exact files changed** with line numbers for significant blocks
- **Root cause analysis** for bugs (helps prevent similar issues)
- **Impact statement** (who/what is affected)
- **Verification method** (how to confirm it works)

**Format rules:**
- Use ISO date format: YYYY-MM-DD
- Use conventional commit types: feat, fix, refactor, docs, test, chore
- Include code file references with line numbers
- Link to related docs or issues if relevant

This changelog follows the pattern from woodhouse_social to prevent undocumented changes.
