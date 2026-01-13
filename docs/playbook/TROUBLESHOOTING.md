# Troubleshooting

**Last Updated:** January 13, 2026

---

## WSL Issues

### WSL Crashes During Build

**Symptom:** Terminal freezes, WSL becomes unresponsive

**Cause:** Running build while dev server is running exhausts 8GB RAM limit

**Fix:**
1. Stop dev server first (Ctrl+C)
2. Clean .next folder
3. Then run build

```bash
rm -rf .next && NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### WSL Won't Start

**Fix:** In PowerShell:
```powershell
wsl --shutdown
wsl -d Ubuntu
```

### Build Slow or Hanging

**Cause:** .next folder bloated (1-2GB)

**Fix:**
```bash
rm -rf .next && npm run build
```

---

## Firestore Issues

### "No dealers found" but data exists

**Cause:** Script querying wrong database (default instead of named)

**Wrong:**
```javascript
const db = admin.firestore();  // Queries default database
```

**Correct:**
```bash
npx tsx -e "
import { getDealers } from './lib/firestore-dealers';
const dealers = await getDealers();
console.log(dealers.length);
"
```

### Permission Denied

**Cause:** Environment variables not loaded

**Fix:**
```bash
set -a && source .env.local && set +a
```

---

## Excel Sync Issues

### "spawn python3 ENOENT" on Vercel

**Cause:** Python not available on Vercel serverless

**Note:** Excel sync only works on localhost. Use dashboard on localhost:3000.

### Wrong Excel Path

**Cause:** WINDOWS_USERNAME not set for current machine

**Fix:** Check username and add to .env.local:

| Machine | WINDOWS_USERNAME |
|---------|-----------------|
| Desktop | GregWood |
| Laptop | gregw |

```env
# In .env.local on laptop
WINDOWS_USERNAME=gregw
```

### Excel File Not Found

**Cause:** OneDrive sync issue or file moved

**Check:**
```bash
ls -la "/mnt/c/Users/GregWood/OneDrive - woodhouseagency.com/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database/"
```

---

## Email Issues

### Email Not Sent

**Check:**
1. Dealer not in blocked list (`lib/blocked-dealers.ts`)
2. `contact_email` is set
3. Resend API key valid

```bash
npx tsx -e "
import { getDealer } from './lib/firestore-dealers';
import { isDealerBlocked } from './lib/blocked-dealers';
const d = await getDealer('10251015');
console.log('Email:', d?.contact_email);
console.log('Blocked:', isDealerBlocked('10251015'));
"
```

### Wrong Email Type Sent

**Logic:**
- `first_post_email_sent` is null → First Post email
- `first_post_email_sent` has value → Post Scheduled email

**Check:**
```bash
npx tsx -e "
import { getDealer } from './lib/firestore-dealers';
const d = await getDealer('10251015');
console.log('First Post Sent:', d?.first_post_email_sent);
"
```

### Spreadsheet Not Updated After Email

**Cause:** Dealer column doesn't exist or API error

**Fix:** Add dealer to spreadsheet first:
```bash
python3 scripts/add_dealer_to_spreadsheet.py 10251015
```

---

## Render Issues

### Jobs Stuck in "pending"

**Cause:** Cron not running or rate limited

**Check:**
```bash
npx tsx -e "
import { db } from './lib/firebase';
const pending = await db.collection('renderQueue').where('status', '==', 'pending').limit(5).get();
console.log('Pending jobs:', pending.size);
"
```

**Manual trigger:**
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://woodhouse-creative.vercel.app/api/cron/process-render-queue
```

### Jobs Stuck in "processing"

**Cause:** Webhook didn't fire or failed

**Check Creatomate dashboard** for render status

**Manual webhook:**
```bash
curl -X POST https://woodhouse-creative.vercel.app/api/creative/manual-webhook \
  -H "Content-Type: application/json" \
  -d '{"renderId": "abc123"}'
```

### Video Not in Drive

**Cause:** Upload failed or wrong folder

**Check:**
```bash
npx tsx -e "
import { db } from './lib/firebase';
const job = await db.collection('renderQueue').doc('JOB_ID').get();
console.log(job.data());
"
```

---

## Google Sheets Issues

### Dealer Column Not Found

**Cause:** Dealer never added to spreadsheet

**Fix:**
```bash
python3 scripts/add_dealer_to_spreadsheet.py 10251015
```

### Copy Not Populated

**Check dealer has required fields:**
```bash
npx tsx -e "
import { getDealer } from './lib/firestore-dealers';
const d = await getDealer('10251015');
console.log('Name:', d?.display_name);
console.log('Phone:', d?.creatomate_phone);
console.log('Website:', d?.creatomate_website);
"
```

---

## TypeScript Errors

### "Cannot find module"

**Fix:**
```bash
npm install
```

### Type Errors

**Common fix:** Use `unknown` instead of `any`:
```typescript
catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
}
```

---

## Git Issues

### Merge Conflicts

**On laptop (sync only):**
```bash
git checkout main
git fetch origin
git reset --hard origin/main
```

### Accidentally Pushed from Laptop

**If not pushed yet:**
```bash
git reset --soft HEAD~1
```

**If already pushed:** Contact Greg to coordinate.

---

## Quick Diagnostic Commands

```bash
# Check environment loaded
echo $NEXT_PUBLIC_FIREBASE_PROJECT_ID

# Check Firestore connection
npx tsx -e "import { getDealers } from './lib/firestore-dealers'; const d = await getDealers(); console.log('Connected, dealers:', d.length);"

# Check Google Sheets
npx tsx -e "import { getSpreadsheetData } from './lib/google-sheets'; const d = await getSpreadsheetData(); console.log('Connected');"

# Check .next size
du -sh .next

# Check memory
free -h
```

---

## Related Documentation

| File | Purpose |
|------|---------|
| [QUICK_COMMANDS.md](QUICK_COMMANDS.md) | Common commands |
| [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) | Workflow details |
