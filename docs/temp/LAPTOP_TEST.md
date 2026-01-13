# Laptop Sync Instructions

**Purpose:** Instructions for syncing to laptop after Microsoft OAuth2 implementation.
**Updated:** January 13, 2026

---

## What Changed

Excel sync now uses Microsoft Graph API with OAuth2 device code flow instead of Python + WSL.

**Key Files Added/Changed:**
- `lib/microsoft-auth.ts` - OAuth2 device code authentication (NEW)
- `lib/sync-excel.ts` - Now uses Graph API instead of Python
- `.microsoft-token-cache.json` - Token cache (committed to repo)
- `scripts/test-microsoft-auth.ts` - Auth test/management CLI (NEW)

---

## First-Time Laptop Setup

### Step 1: Pull Latest Code
```bash
cd ~/woodhouse_creative
git pull origin main
npm install  # In case new dependencies added
```

### Step 2: Verify .env.local
Make sure laptop's `.env.local` has these Microsoft vars (should already be there):
```env
MICROSOFT_TENANT_ID="6e2ff6f5-2943-474f-a4ae-cd7566bb8ccc"
MICROSOFT_CLIENT_ID="7a9582ea-4528-4667-ac11-2e559723a565"
SHAREPOINT_OWNER_EMAIL="greg@woodhouseagency.com"
SHAREPOINT_FILE_PATH="/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database/Turnkey Social Media - Dealers - Current.xlsm"
```

Also make sure `WINDOWS_USERNAME` is correct for laptop:
```env
WINDOWS_USERNAME="gregw"
```

### Step 3: Test Token Cache
The token cache file `.microsoft-token-cache.json` was committed from desktop. Test if it works:

```bash
cd ~/woodhouse_creative
set -a && source .env.local && set +a
npx tsx scripts/test-microsoft-auth.ts --status
```

**Expected output:**
```
Token status: Valid token cached
Cached account: greg@woodhouseagency.com
```

If you see this, skip to Step 5.

### Step 4: Re-authenticate (Only If Needed)
If Step 3 shows "No valid token", the cached token expired or didn't transfer correctly. Re-authenticate:

```bash
npx tsx scripts/test-microsoft-auth.ts
```

This will:
1. Display a code (e.g., `ABCD1234`)
2. Ask you to visit `microsoft.com/devicelogin`
3. Enter the code and sign in with `greg@woodhouseagency.com`

After authenticating, the new token will be cached for 90 days.

### Step 5: Test Excel Sync
```bash
npx tsx -e "
import { syncFromExcel } from './lib/sync-excel';
const { changes } = await syncFromExcel(false);
console.log('New:', changes.new.length);
console.log('Removed:', changes.removed.length);
console.log('Updated:', changes.updated.length);
console.log('Unchanged:', changes.unchanged.length);
"
```

**Expected output:**
```
New: 0
Removed: 0
Updated: 0
Unchanged: 342
```

### Step 6: Test Firestore (Read-Only)
```bash
npx tsx -e "
import { getDealers } from './lib/firestore-dealers';
const all = await getDealers();
console.log('Total:', all.length, '- FULL:', all.filter(d => d.program_status === 'FULL').length);
"
```

**Expected:** `Total: ~350 - FULL: ~130`

### Step 7: Test Dev Server
```bash
npm run dev
# Visit http://localhost:3000/admin
# Click "Sync from Excel" - should work without errors
```

---

## Token Management Commands

```bash
# Check token status
npx tsx scripts/test-microsoft-auth.ts --status

# Run full auth test (tests Graph API access)
npx tsx scripts/test-microsoft-auth.ts

# Force re-authentication (clears cache)
npx tsx scripts/test-microsoft-auth.ts --clear
npx tsx scripts/test-microsoft-auth.ts
```

---

## Token Sharing Between Machines

The token cache is committed to the repo, so both machines share the same auth session:

**Desktop authenticates → commits → laptop pulls → laptop uses same token**

Token lifetime: Up to 90 days (refresh token).

If token expires on one machine and you re-authenticate, commit and push the new `.microsoft-token-cache.json` so the other machine gets it too.

---

## What NOT To Do on Laptop

Unless intentionally testing:
- Don't run sync with `apply: true`
- Don't click "Populate All" or "Process All" buttons
- Don't approve dealers in dealer-review
- Don't send emails

---

## Troubleshooting

### "No cached accounts found"
Token cache didn't transfer correctly. Re-authenticate:
```bash
npx tsx scripts/test-microsoft-auth.ts --clear
npx tsx scripts/test-microsoft-auth.ts
```

### "Service account object must contain..."
Missing Firebase env vars. Check `.env.local` has:
```env
NEXT_PUBLIC_FIREBASE_PROJECT_ID="woodhouse-social"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-..."
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

### Excel sync returns empty or wrong data
Check that `SHAREPOINT_FILE_PATH` is correct and the Excel file hasn't been moved.

---

---

## Test Results (January 13, 2026)

**All tests completed successfully!**

### ✅ Step 1-3: Setup & Token Test
- Pulled latest code
- Microsoft credentials added to .env.local
- Token cache verified: "Valid token cached"

### ✅ Step 5: Excel Sync Test
```
New: 0
Removed: 0
Updated: 0
Unchanged: 342
```
**Result:** Excel sync working perfectly via Microsoft Graph API!
- Downloaded 418KB Excel file from SharePoint
- Parsed all 342 dealers successfully
- No Python/pandas required

### ✅ Step 6: Firestore Test
```
Total: 351 - FULL: 131
```
**Result:** Firestore connection working

### Status: ✅ LAPTOP FULLY SYNCED
- Excel sync works on laptop (OAuth2 + Graph API)
- Firestore queries working
- All env vars configured
- Ready for development

---

## After Testing

This file documents the successful Microsoft OAuth2 implementation and laptop sync verification. Keep for reference.
