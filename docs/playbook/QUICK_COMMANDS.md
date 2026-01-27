# Quick Commands

**Last Updated:** January 13, 2026

---

## Environment Setup

```bash
# Load environment variables
cd ~/woodhouse_creative
set -a && source .env.local && set +a
```

---

## Development

```bash
# Start dev server (let Greg run this so he can Ctrl+C)
npm run dev

# Build (stop dev server first!)
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Clean build
rm -rf .next && npm run build
```

---

## Git

```bash
# Quick commit and push
ga && git commit -m "message" && gpush

# Aliases
gp        # git pull
gs        # git status
gpush     # git push
ga        # git add .
```

---

## Query Firestore

**IMPORTANT:** Use `npx tsx` with library imports, NOT standalone scripts.

```bash
# Count dealers
npx tsx -e "
import { getDealers } from './lib/firestore-dealers';
const all = await getDealers();
const full = all.filter(d => d.program_status === 'FULL').length;
console.log('Total:', all.length, '- FULL:', full);
"

# Get specific dealer
npx tsx -e "
import { getDealer } from './lib/firestore-dealers';
const d = await getDealer('10251015');
console.log(JSON.stringify(d, null, 2));
"

# List pending review
npx tsx -e "
import { getDealers } from './lib/firestore-dealers';
const pending = await getDealers({ review_status: 'pending_review' });
pending.forEach(d => console.log(d.dealer_no, d.dealer_name));
"

# Check email status
npx tsx -e "
import { getDealer } from './lib/firestore-dealers';
const d = await getDealer('10251015');
console.log('Welcome:', d?.welcome_email_sent);
console.log('FB Admin:', d?.fb_admin_accepted_email_sent);
console.log('First Post:', d?.first_post_email_sent);
console.log('Last Post:', d?.last_post_email_sent);
"
```

---

## Send Emails

### Via TypeScript

```bash
npx tsx -e "
import { sendFbAdminAcceptedEmail } from './lib/email';
await sendFbAdminAcceptedEmail('10251015');
console.log('Sent!');
"
```

### Via Python

```bash
# Welcome
python3 scripts/email_sender/send_email.py welcome 10251015

# FB Admin Accepted
python3 scripts/email_sender/send_email.py fb_admin_accepted 10251015

# Post Scheduled
python3 scripts/email_sender/send_email.py post_scheduled 10251015

# Dry run
python3 scripts/email_sender/send_email.py welcome 10251015 --dry-run
```

---

## Dealer Operations

### Promote/Demote

```bash
# Promote to FULL
python3 scripts/update_dealer_status.py --promote --dealer-no 10251015

# Demote to CONTENT
python3 scripts/update_dealer_status.py --demote --dealer-no 10251015
```

### Add to Spreadsheet

```bash
python3 scripts/add_dealer_to_spreadsheet.py 10251015
```

---

## Excel Sync (Local Only)

```bash
# Preview changes
python3 scripts/sync_from_excel.py

# Apply changes
python3 scripts/sync_from_excel.py --apply
```

---

## Batch Render

```bash
# Dry run
python3 scripts/batch_render.py --post 700 --template abc123 --dry-run

# Single dealer
python3 scripts/batch_render.py --post 700 --template abc123 --dealer 10251015

# All FULL dealers
python3 scripts/batch_render.py --post 700 --template abc123
```

---

## SQLite Queries (Reference)

```bash
# Count FULL dealers
sqlite3 data/sqlite/creative.db "SELECT COUNT(*) FROM dealers WHERE program_status = 'FULL';"

# Find dealer
sqlite3 data/sqlite/creative.db "SELECT dealer_no, display_name FROM dealers WHERE dealer_name LIKE '%Wiesbrook%';"

# List all FULL
sqlite3 data/sqlite/creative.db "SELECT dealer_no, display_name FROM dealers WHERE program_status = 'FULL' ORDER BY display_name;"
```

---

## WSL Recovery

If WSL crashes:

```powershell
# In PowerShell
wsl --shutdown
wsl -d Ubuntu
```

---

## Dashboard URLs

| Page | URL |
|------|-----|
| Main Dashboard | http://localhost:3000/admin |
| Dealer Review | http://localhost:3000/admin/dealer-review |
| Posts | http://localhost:3000/admin/posts |
| Email Templates | http://localhost:3000/admin/email-templates |

---

## External Service Logins

| Service | Login | URL |
|---------|-------|-----|
| Resend (woodhouse_creative) | Google login: `communitymanagers@woodhousesocial.com` | [resend.com](https://resend.com) |

**Note:** The Resend account uses the `woodhouseagency.com` sending domain, but login is via Google with the `communitymanagers@woodhousesocial.com` account.

---

## Related Documentation

| File | Purpose |
|------|---------|
| [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) | Full workflow details |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues |
