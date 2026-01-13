# Email Automation

**Last Updated:** January 13, 2026

---

## Overview

Automated emails are sent via Resend API to keep dealers informed about their social media program.

**Sender:** `Woodhouse Social Community Managers <communitymanagers@woodhouseagency.com>`
**Domain:** woodhouseagency.com (verified)

---

## Email Types

| Email | Template | Trigger | Recipient |
|-------|----------|---------|-----------|
| Welcome | `welcome.html` | New dealer enrollment | Dealer contact |
| FB Admin Accepted | `fb_admin_accepted.html` | Accepted FB admin invite | Dealer contact |
| First Post Scheduled | `first_post_scheduled.html` | First posts scheduled | Dealer contact |
| Post Scheduled | `post_scheduled.html` | Ongoing post notifications | Dealer contact |
| Content Ready | `content_ready.html` | Monthly content available | Dealer contact |
| Onboarding Complete | (internal) | Dealer approved in review | Olivia |

---

## Email Details

### Welcome Email

**Trigger:** New dealer signs up via Allied Air
**Template:** `templates/emails/welcome.html`
**Tracking Field:** `welcome_email_sent`

**Content:**
- Welcome to Turnkey Social Media program
- What to expect
- How to provide Facebook admin access

---

### FB Admin Accepted Email

**Trigger:** Dealer accepts Facebook admin invitation
**Template:** `templates/emails/fb_admin_accepted.html`
**Tracking Field:** `fb_admin_accepted_email_sent`

**Content:**
- Confirmation we received admin access
- What happens next
- Timeline for first posts

---

### First Post Scheduled Email

**Trigger:** First batch of posts scheduled for new FULL dealer
**Template:** `templates/emails/first_post_scheduled.html`
**Tracking Field:** `first_post_email_sent`

**Content:**
- Posts are now scheduled
- Preview of upcoming content
- How to view scheduled posts

---

### Post Scheduled Email

**Trigger:** Ongoing post scheduling (after first)
**Template:** `templates/emails/post_scheduled.html`
**Tracking Field:** `last_post_email_sent`

**Content:**
- New posts scheduled
- What's coming up
- Contact for questions

---

### Content Ready Email

**Trigger:** Monthly content available for CONTENT dealers
**Template:** `templates/emails/content_ready.html`
**Required:** `--download-url` parameter

**Content:**
- New content is ready
- Download link
- How to post

---

### Onboarding Complete Email (Internal)

**Trigger:** Dealer approved via dealer-review dashboard
**Recipient:** Olivia (internal team)
**No Template:** Generated inline

**Content:**
- Dealer name and number
- Number of posts queued
- Spreadsheet column location

---

## Sending Emails

### Via Dashboard

1. Navigate to `/admin`
2. Find "Process Done Emails" section
3. Click "Send" for individual dealers
4. Or click "Process All"

### Via TypeScript

```typescript
import { sendFbAdminAcceptedEmail } from '@/lib/email';

await sendFbAdminAcceptedEmail('10251015');
```

### Via Python (CLI)

```bash
# Set environment
cd ~/woodhouse_creative
set -a && source .env.local && set +a

# Send email
python3 scripts/email_sender/send_email.py fb_admin_accepted 10251015

# Dry run
python3 scripts/email_sender/send_email.py welcome 10251015 --dry-run

# Skip spreadsheet update
python3 scripts/email_sender/send_email.py post_scheduled 10251015 --no-spreadsheet
```

---

## Email Template Variables

| Variable | Source | Example |
|----------|--------|---------|
| `{{first_name}}` | `contact_first_name` | "Guy" |
| `{{dealer_name}}` | `display_name` | "Wiesbrook Sheet Metal" |
| `{{email}}` | `contact_email` | "guy@wsminc.net" |
| `{{download_url}}` | Parameter | "https://drive.google.com/..." |

---

## Blocked Dealers

Test accounts are blocked from receiving emails.

**TypeScript:** `lib/blocked-dealers.ts`
**Python:** `scripts/email_sender/blocked_dealers.py`

```typescript
const BLOCKED_DEALER_NOS = new Set([
  '10491009',  // GW Berkheimer HQ Test Account
]);
```

To add a blocked dealer, update BOTH files.

---

## Spreadsheet Integration

After sending emails, the spreadsheet is automatically updated:

| Status | Meaning |
|--------|---------|
| Pending | Dealer needs scheduling |
| Done | Posts scheduled, awaiting email |
| Email Sent | Email sent successfully |

Update happens in Row 2 of dealer's column.

---

## Email Flow by Dealer Lifecycle

```
New Signup
    ↓
Welcome Email → welcome_email_sent
    ↓
[Accepts FB Admin]
    ↓
FB Admin Accepted Email → fb_admin_accepted_email_sent
    ↓
[Posts Scheduled - First Time]
    ↓
First Post Scheduled Email → first_post_email_sent
    ↓
[Posts Scheduled - Ongoing]
    ↓
Post Scheduled Email → last_post_email_sent
```

---

## Troubleshooting

### Email Not Sent

1. Check dealer is not in blocked list
2. Verify `contact_email` is set
3. Check Resend API key is valid
4. Look for errors in Vercel logs

### Wrong Email Type Sent

Email type is determined by:
- `first_post_email_sent` is null → First Post email
- `first_post_email_sent` has value → Post Scheduled email

### Spreadsheet Not Updated

Use `--no-spreadsheet` flag if:
- Testing email sending
- Spreadsheet column doesn't exist yet

---

## Related Documentation

| File | Purpose |
|------|---------|
| [DEALER_LIFECYCLE.md](DEALER_LIFECYCLE.md) | Status transitions |
| [ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md) | Dashboard email features |
| [../engineering/TYPESCRIPT_MODULES.md](../engineering/TYPESCRIPT_MODULES.md) | email.ts module |
