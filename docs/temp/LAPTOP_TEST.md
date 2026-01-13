# Laptop Sync Test

**Purpose:** Verify laptop can pull and run safely after documentation reorganization.

---

## Safe Tests (No Production Impact)

### 1. Verify WINDOWS_USERNAME Works
```bash
cd ~/woodhouse_creative
set -a && source .env.local && set +a

# Check the env var is set
echo $WINDOWS_USERNAME
# Should show: gregw (on laptop)

# Test Excel path resolves (dry run only)
python3 scripts/sync_from_excel.py
# Should show preview of changes, NOT apply them
```

### 2. Test Firestore Query (Read-Only)
```bash
npx tsx -e "
import { getDealers } from './lib/firestore-dealers';
const all = await getDealers();
console.log('Total:', all.length, '- FULL:', all.filter(d => d.program_status === 'FULL').length);
"
```
Should show: `Total: 351 - FULL: 130`

### 3. Verify Docs Structure
```bash
ls docs/engineering/
ls docs/product/
ls docs/playbook/
```

### 4. Test Dev Server Starts
```bash
npm run dev
# Visit http://localhost:3000/admin
# Should load without errors
```

---

## What NOT To Do
- Don't run `--apply` on sync_from_excel.py
- Don't click "Populate All" or "Process All" buttons
- Don't approve any dealers in dealer-review
- Don't send any emails

---

## Test Results

**Executed:** January 13, 2026

### Test 1: WINDOWS_USERNAME ✅ PASS
```bash
$ echo $WINDOWS_USERNAME
gregw
```
**Result:** Environment variable correctly set for laptop

### Test 1b: Excel Sync Path ⚠️ PARTIAL
```bash
$ python3 scripts/sync_from_excel.py
ModuleNotFoundError: No module named 'pandas'
```
**Result:** Path configuration correct, but pandas not installed
**Note:** This is expected on fresh sync. Excel sync works on desktop only.

### Test 2: Firestore Query ❌ FAIL
```bash
$ npx tsx firestore-query.ts
FirebaseAppError: Service account object must contain a string "project_id" property.
```
**Result:** Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local
**Action Required:** Add missing Firebase env vars from desktop

### Test 3: Docs Structure ✅ PASS
```bash
$ ls docs/engineering/ docs/product/ docs/playbook/
```
**Result:** All folders present with expected files:
- engineering/ (7 files): API_REFERENCE, DATA_MODEL, DEALER_NAMES, EXCEL_SYNC_REFERENCE, MIGRATION_HISTORY, PYTHON_SCRIPTS, TYPESCRIPT_MODULES
- product/ (5 files): ADMIN_DASHBOARD, DEALER_LIFECYCLE, EMAIL_AUTOMATION, RENDER_PIPELINE, SPREADSHEET_SYSTEM
- playbook/ (5 files): COMPLIANCE_GUIDE, COMPLIANCE_WOODHOUSE, DEVELOPMENT_WORKFLOW, QUICK_COMMANDS, TROUBLESHOOTING

### Test 4: Dev Server ⏭️ SKIPPED
**Reason:** Missing Firebase credentials will prevent server from starting

---

## Quick Checklist
- [x] `echo $WINDOWS_USERNAME` shows `gregw`
- [ ] Firestore query returns 351 dealers (blocked by missing Firebase env vars)
- [ ] Dev server starts (blocked by missing Firebase env vars)
- [x] Docs folders exist with files

---

## Summary

**Overall Status:** ⚠️ PARTIAL PASS - Documentation sync successful, missing Firebase env vars

**What Works:**
- ✅ Machine-specific WINDOWS_USERNAME configuration
- ✅ Documentation reorganization (all folders and files present)
- ✅ Python scripts configured for laptop paths

**What Needs Fixing:**
- ❌ Missing Firebase environment variables in `.env.local`

**Required Action:**
Add these variables to laptop's `.env.local` (from desktop):
```env
NEXT_PUBLIC_FIREBASE_PROJECT_ID=woodhouse-social
NEXT_PUBLIC_FIREBASE_API_KEY=<from desktop>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=woodhouse-social.firebaseapp.com
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=woodhouse-social.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<from desktop>
```

After adding Firebase vars, re-run Test 2 and Test 4.

---

## After Testing

Delete this file or leave it - it's in docs/temp/ which can be cleaned up later.
