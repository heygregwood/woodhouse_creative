# Changelog

All notable changes to Woodhouse Creative are documented here.

**Format:** `[YYYY-MM-DD] - [Feature/Fix Name]`

---

## [2026-01-27] - Add Manage Existing Dealers to Dealer Review Page

### Added
- **Manage Existing Dealers section** on `/admin/dealer-review`
  - Search by dealer name or number (client-side, instant)
  - Shows 10 most recently modified FULL dealers by default
  - "Show All" expands to full alphabetical list
  - Lazy-loads on first interaction (doesn't slow down pending review)
  - Inline editing of display name, phone, website, and logo
  - "Save Changes" button updates Firestore only (no re-renders triggered)
  - Compact collapsed card view for quick scanning, expand to edit

- **PATCH `/api/admin/dealer-review`** — field-only update endpoint
  - Updates display_name, creatomate_phone, creatomate_website, creatomate_logo
  - No automation pipeline (no spreadsheet sync, renders, or emails)

- **GET `/api/admin/dealer-review?section=existing`** — fetch approved FULL dealers
  - Returns all FULL dealers with `ready_for_automate: 'yes'`, sorted by `updated_at` desc

### Changed
- **Refactored dealer-review page** from 700-line monolith into modular components:
  - `page.tsx` (~230 lines) — orchestrator with shared state
  - `components/DealerCard.tsx` (~270 lines) — reusable editable form card
  - `components/LogoFinderOverlay.tsx` (~170 lines) — shared logo finder modal
  - `components/ManageExistingDealers.tsx` (~270 lines) — section 2 container
- Logo finder overlay now shared between pending review and manage sections
  via `source` field in overlay state

### Files Changed
- `app/api/admin/dealer-review/route.ts` — added PATCH handler, modified GET
- `app/admin/dealer-review/page.tsx` — refactored as orchestrator
- `app/admin/dealer-review/components/DealerCard.tsx` — new
- `app/admin/dealer-review/components/LogoFinderOverlay.tsx` — new
- `app/admin/dealer-review/components/ManageExistingDealers.tsx` — new

---

## [2026-01-27] - Fix Google Drive Duplicate Folder Race Condition

### Fixed
- **Race condition in `ensureFolderPath()`** (`lib/google-drive.ts:117-230`)
  - When multiple Creatomate webhooks arrive simultaneously for the same dealer,
    concurrent calls to `ensureFolderPath()` could create duplicate folders with
    identical names in Google Drive
  - **Root cause:** TOCTOU (time-of-check-to-time-of-use) — two concurrent calls
    both check "does folder exist?", both get "no", both create it
  - **Fix — Layer 1:** In-process promise lock (`folderCreationLocks` Map) — concurrent
    calls for the same path within the same serverless instance share one promise
  - **Fix — Layer 2:** Post-creation verification — after creating a folder, re-queries
    Google Drive; if duplicates exist, keeps the oldest and deletes the rest
  - **Impact:** Prevents duplicate dealer folders for all future batch renders

### Changed
- **`createDriveFolder()` in `app/api/admin/dealer-status/route.ts`** now delegates
  to the shared `getFolderIdByPath()` from `lib/google-drive.ts` instead of using its
  own folder creation logic, ensuring all folder creation goes through the
  race-protected code path

### Investigated
- **Comfort Specialist Heating & Air (10453075):** Two folders created Jan 19 — one
  with 16 videos, one empty. Empty folder already deleted.
- **Reliable Climate Control LLC (10529007):** Two folders created Jan 26 — same
  pattern. Empty folder already deleted.
- **Welling Service Company (10130):** Folder "10130 - Welling Service Company" (empty,
  different naming convention) + "Welling Service Company" (16 videos). All reels present.
  Olivia notified via email with direct folder link.

---

## [2026-01-13] - Documentation Reorganization & Cleanup

### Added
- docs: Reorganized documentation into structured subfolders
  - **New structure:** `docs/engineering/`, `docs/product/`, `docs/playbook/`, `docs/archive/`
  - **Engineering docs (4 new files):**
    - `docs/engineering/DATA_MODEL.md` - Merged DATABASE.md + DATA_ARCHITECTURE.md, Firestore schema
    - `docs/engineering/API_REFERENCE.md` - All 28 API endpoints with request/response formats
    - `docs/engineering/TYPESCRIPT_MODULES.md` - lib/*.ts documentation
    - `docs/engineering/PYTHON_SCRIPTS.md` - CLI scripts reference
  - **Product docs (5 new files):**
    - `docs/product/ADMIN_DASHBOARD.md` - Dashboard pages and features
    - `docs/product/DEALER_LIFECYCLE.md` - CONTENT → FULL → REMOVED states
    - `docs/product/RENDER_PIPELINE.md` - Video rendering workflow
    - `docs/product/EMAIL_AUTOMATION.md` - 6 email types and triggers
    - `docs/product/SPREADSHEET_SYSTEM.md` - Google Sheets structure
  - **Playbook docs (3 new files):**
    - `docs/playbook/QUICK_COMMANDS.md` - Common commands for daily use
    - `docs/playbook/DEVELOPMENT_WORKFLOW.md` - Local → Preview → Production
    - `docs/playbook/TROUBLESHOOTING.md` - Common issues and fixes
  - **Impact:** Clear organization, easier navigation

### Changed
- docs: Updated CLAUDE.md with critical sections
  - **Added:** Machine-specific config (Desktop vs Laptop WINDOWS_USERNAME)
  - **Added:** Firestore query section with npx tsx examples
  - **Updated:** Quick Links to point to new docs structure
  - **Updated:** Current Status to January 2026 with Firestore counts (351 total, 130 FULL)
  - **Impact:** Correct Firestore queries, laptop sync works

### Removed
- cleanup: Deleted 52 obsolete Python scripts
  - **Scripts removed:** Migration, import, validation, testing scripts no longer needed
  - **Scripts kept (7 + email module):**
    - batch_render.py, sync_from_excel.py, process_done_status.py
    - update_dealer_status.py, sync_spreadsheet.py, add_dealer_to_spreadsheet.py
    - populate_post_copy.py, email_sender/send_email.py, email_sender/blocked_dealers.py
  - **Impact:** Cleaner scripts directory, reduced confusion

### Files Modified
1. `docs/README.md` - Complete rewrite with new navigation structure
2. `CLAUDE.md` - Added Firestore query section, laptop sync fix, updated Quick Links
3. `docs/engineering/*.md` - 7 files (4 new, 3 moved)
4. `docs/product/*.md` - 5 new files
5. `docs/playbook/*.md` - 5 files (3 new, 2 moved)
6. `docs/archive/*.md` - 4 files moved from root

### Verification
- All documentation links tested
- Firestore query examples verified to work with named database
- Laptop WINDOWS_USERNAME config documented

---

## [2026-01-12] - Automated Dealer Onboarding Workflow

### Added
- feat: Fully automated dealer onboarding after approval
  - **New file:** `templates/emails/onboarding_complete.html` - Email template for Olivia notifications
  - **New function:** `lib/email.ts:sendOnboardingCompleteEmail()` (lines 497-527) - Sends completion notification to Olivia
  - **New functions:** `lib/google-sheets.ts:getActivePostsFromSpreadsheet()` (lines 327-363), `populatePostCopyForDealer()` (lines 365-409) - Get active posts and populate personalized copy
  - **Impact:** Eliminates 95% of manual onboarding work (15 minutes → <1 minute)

- feat: One-click logo save with auto-population
  - **New API:** `app/api/admin/save-logo-permanent/route.ts` - Move logo from staging to permanent folder
  - **New function:** `lib/google-drive.ts:getFileShareableLink()` (lines 388-414) - Generate shareable Drive URLs
  - **UI change:** `app/admin/dealer-review/page.tsx:saveLogoPermanently()` (lines 216-248) - Auto-fill logo URL after permanent save
  - **Impact:** Reduces logo workflow from 6 manual steps to 1 click

### Changed
- refactor: Enhanced dealer approval with full automation orchestration
  - **File:** `app/api/admin/dealer-review/route.ts` (lines 62-191) - Complete rewrite of POST handler
  - **Added:** Automatic spreadsheet column assignment
  - **Added:** Post copy population for all active posts
  - **Added:** Render job creation for single dealer
  - **Added:** Dual email notifications (dealer + Olivia)
  - **Added:** Comprehensive error handling with warnings
  - **Impact:** Approval now triggers 9 automated steps instead of 2

- refactor: Website field made optional during dealer review
  - **File:** `app/admin/dealer-review/page.tsx` (line 217) - Removed website from validation
  - **File:** `app/api/admin/dealer-review/route.ts` (line 75) - Allow empty website value
  - **Impact:** Many dealers don't have websites, validation was blocking approvals

- feat: Facebook profile picture added to logo search
  - **File:** `app/api/admin/fetch-logos/route.ts` (lines 178-238) - Added Facebook Graph API call
  - **Added:** Query Firestore for `facebook_page_id`
  - **Added:** Fetch high-res profile picture using public API
  - **Impact:** More logo options available, better quality logos

- feat: Render batch API supports single dealer filtering
  - **File:** `app/api/creative/render-batch/route.ts` (line 18) - Added optional `dealerNo` parameter
  - **File:** `app/api/creative/render-batch/route.ts` (lines 78-105) - Filter dealers query by dealerNo
  - **Impact:** Can create render jobs for one dealer instead of all 124

- enhancement: Comprehensive success message in dealer review UI
  - **File:** `app/admin/dealer-review/page.tsx` (lines 483-551) - Enhanced approval result display
  - **Added:** Shows spreadsheet column, posts populated, render batches created
  - **Added:** Displays estimated completion time
  - **Added:** Warning section for partial failures
  - **Impact:** User gets full visibility into automation results

### Fixed
- fix: Typo in onboarding_complete email template
  - **File:** `templates/emails/onboarding_complete.html` (line 37) - Fixed CSS syntax error (removed extra colon)

### Files Modified
1. `app/admin/dealer-review/page.tsx` - Added logo save button, enhanced success message
2. `app/api/admin/dealer-review/route.ts` - Full automation orchestration
3. `app/api/admin/fetch-logos/route.ts` - Facebook profile picture support
4. `app/api/creative/render-batch/route.ts` - Single dealer filtering
5. `lib/google-sheets.ts` - Helper functions for active posts and post copy
6. `lib/email.ts` - Onboarding complete email function
7. `lib/google-drive.ts` - Shareable link generation
8. `templates/emails/onboarding_complete.html` - NEW: Olivia notification template
9. `app/api/admin/save-logo-permanent/route.ts` - NEW: Logo permanent save API

### Verification
**Manual testing required:**
1. Test dealer approval on localhost with test dealer
2. Verify spreadsheet column created with metadata
3. Verify post copy populated for all active posts
4. Verify render jobs created in Firestore (only for test dealer, not all 124)
5. Verify Olivia receives email with all details
6. Verify dealer receives FB Admin email
7. Verify success message shows comprehensive results
8. Verify "Save Permanently & Auto-Fill" button works

**Firestore posts collection:**
- ✅ Initialized on 2026-01-12
- Script: `scripts/init-firestore-posts.ts`
- Mapping file: `scripts/posts-template-mapping.json`
- Result: 6 posts created successfully (posts 666, 667, 668, 669, 671, 672)
- Note: Post 673 missing from template mapping (expected)

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
