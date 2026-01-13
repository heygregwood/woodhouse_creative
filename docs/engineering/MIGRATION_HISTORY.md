# Vercel Migration Progress

**Goal:** Make woodhouse_creative fully functional on Vercel without localhost dependencies

**Started:** January 9, 2026
**Status:** Phase 1 Complete, Phase 2 In Progress

---

## ✅ Phase 1: Infrastructure Setup (COMPLETE)

### Database Migration
- [x] Created `woodhouse-creative-db` Firestore database (separate from woodhouse_social)
- [x] Migrated 882 renderQueue documents
- [x] Migrated 7 renderBatches documents
- [x] Migrated 341 dealers from SQLite to Firestore
- [x] Updated `lib/firebase.ts` to use new database

### Core Libraries Created
- [x] `lib/email.ts` - TypeScript email module (replaces Python `send_email.py`)
- [x] `lib/google-sheets.ts` - Spreadsheet operations (replaces Python `add_dealer_to_spreadsheet.py`)
- [x] `lib/firestore-dealers.ts` - Firestore CRUD operations
- [x] `lib/blocked-dealers.ts` - Added TESTING_MODE flag

### Fixes
- [x] Fixed `lib/sync-excel.ts` - Restored closing braces, uncommented programStatus

---

## 🚧 Phase 2: Route Updates (IN PROGRESS)

### Email Routes (4 routes - Python → TypeScript)

**Route:** `/api/admin/sync-excel`
- [ ] Replace `sendEmail()` function with TypeScript version
- [ ] Import from `lib/email.ts`
- [ ] Test with test dealer 99999999

**Route:** `/api/admin/process-done`
- [ ] Replace `sendEmail()` function with TypeScript version
- [ ] Import from `lib/email.ts`
- [ ] Update email timestamp writes to use Firestore

**Route:** `/api/admin/send-welcome-email`
- [ ] Replace `runEmailScript()` with TypeScript version
- [ ] Import from `lib/email.ts`

**Route:** `/api/admin/dealer-review`
- [ ] Replace `sendEmail()` function with TypeScript version
- [ ] Replace `addDealerToSpreadsheet()` with TypeScript version
- [ ] Import from `lib/email.ts` and `lib/google-sheets.ts`
- [ ] Update dealer approval writes to use Firestore

---

## 🔜 Phase 3: Firestore Write Routes (7 routes)

### Database Write Operations (SQLite → Firestore)

**Route:** `/api/admin/sync-excel` (applyChanges)
- [ ] Update `lib/sync-excel.ts` applyChanges() to use Firestore
- [ ] Use `createDealer()`, `updateDealer()`, `markDealerRemoved()` from `lib/firestore-dealers.ts`

**Route:** `/api/admin/save-logo`
- [ ] Replace SQLite UPDATE with Firestore
- [ ] Use `updateLogo()` from `lib/firestore-dealers.ts`

**Route:** `/api/admin/dealer-status`
- [ ] Replace SQLite UPDATE with Firestore
- [ ] Use `promoteToFull()`, `demoteToContent()` from `lib/firestore-dealers.ts`

**Route:** `/api/admin/mark-needs-design`
- [ ] Replace SQLite UPDATE with Firestore
- [ ] Use `markNeedsDesign()` from `lib/firestore-dealers.ts`

**Route:** `/api/admin/submit-post`
- [ ] Create Firestore collection `posts` (replace SQLite table)
- [ ] Update INSERT logic

**Route:** `/api/admin/process-done` (email timestamps)
- [ ] Replace SQLite UPDATE with Firestore
- [ ] Use `updateEmailTimestamp()` from `lib/firestore-dealers.ts`

**Route:** `/api/admin/dealer-review` (approval)
- [ ] Replace SQLite UPDATE with Firestore
- [ ] Use `approveDealer()` from `lib/firestore-dealers.ts`

---

## 📋 Phase 4: Testing & Verification

- [ ] Enable TESTING_MODE in `lib/blocked-dealers.ts`
- [ ] Test Excel sync with test dealer 99999999
- [ ] Test email sending (welcome email)
- [ ] Test spreadsheet operations
- [ ] Verify Firestore writes
- [ ] Disable TESTING_MODE
- [ ] Push to Vercel Preview
- [ ] Test on production

---

## 📝 Notes

### Testing Strategy
1. Set `TESTING_MODE = true` in `lib/blocked-dealers.ts`
2. Only dealer `99999999` will receive emails
3. Test all workflows locally first
4. Push to Vercel Preview
5. Test on Preview
6. Set `TESTING_MODE = false`
7. Deploy to production

### Compliance
- `woodhouse-creative-db` database is completely separate from `woodhouse_social` SaaS
- Can delete `renderQueue` and `renderBatches` from `(default)` database after verifying migration
- SQLite will remain for READ operations initially (dual-read strategy)

---

## Files Created This Session

### Library Modules
- `lib/email.ts` (554 lines)
- `lib/google-sheets.ts` (317 lines)
- `lib/firestore-dealers.ts` (426 lines)

### Migration Scripts
- `scripts/migrate-render-collections.js`
- `scripts/migrate-sqlite-to-firestore.js`

### Updates
- `lib/firebase.ts` - Use `woodhouse-creative-db`
- `lib/blocked-dealers.ts` - Add TESTING_MODE
- `lib/sync-excel.ts` - Fix closing braces
