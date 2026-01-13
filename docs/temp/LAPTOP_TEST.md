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

## Quick Checklist
- [ ] `echo $WINDOWS_USERNAME` shows `gregw`
- [ ] Firestore query returns 351 dealers
- [ ] Dev server starts
- [ ] Docs folders exist with files

---

## After Testing

Delete this file or leave it - it's in docs/temp/ which can be cleaned up later.
