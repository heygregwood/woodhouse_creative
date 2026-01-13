# Admin Dashboard

**Last Updated:** January 13, 2026
**URL:** https://woodhouse-creative.vercel.app/admin
**Local:** http://localhost:3000/admin

---

## Overview

The admin dashboard provides tools for managing dealer automation, batch rendering, email sending, and spreadsheet operations.

---

## Dashboard Pages

### `/admin` - Main Dashboard

**Features:**

| Section | Purpose |
|---------|---------|
| **Quick Stats** | Dealer counts, post counts, ready status |
| **Excel Sync** | Preview/apply changes from Allied Excel (LOCAL ONLY) |
| **Batch Render** | Submit post number + template for video rendering |
| **Populate Post Copy** | Enter base copy, populate to all dealers |
| **Process Done Emails** | Send emails to dealers marked "Done" |

**Excel Sync Limitation:**
Only works on localhost. Requires Python + WSL OneDrive access to read Allied Excel file.

---

### `/admin/posts` - Post Workflow

**Features:**
- View post archive (656+ posts)
- Create/submit new posts with metadata
- View scheduling spreadsheet status
- Filter by season, subject matter

**Post Fields:**
- Post number
- Base copy (with {name}, {phone}, {website} placeholders)
- Season (Fall, Winter, Spring, Summer)
- Subject matter
- Tags
- Approval status

---

### `/admin/dealer-review` - Dealer Approval

**Purpose:** Review and approve dealers promoted to FULL status.

**Workflow:**
1. Dealer is promoted from CONTENT → FULL (via Gmail webhook or manual)
2. Dealer appears in review queue with `review_status = 'pending_review'`
3. Admin validates:
   - Display name (proper case, "and" not "&")
   - Phone number (formatted: 630-555-1234)
   - Website (domain only: wsminc.net)
   - Logo (select from Brandfetch, website, Facebook)
4. Click "Approve" to set `ready_for_automate = 'yes'`

**Logo Sources:**
- **Brandfetch** - Professional logo API
- **Website** - Favicon, apple-touch-icon, og:image
- **Facebook** - Profile photo, cover photo

**Post-Approval Actions:**
After approval, the system automatically:
1. Adds dealer column to scheduling spreadsheet
2. Queues renders for active posts
3. Sends welcome email (if not sent)
4. Notifies Olivia of new FULL dealer

---

### `/admin/email-templates` - Template Editor

**Purpose:** View and edit email templates.

**Available Templates:**
| Template | File | Trigger |
|----------|------|---------|
| Welcome | `welcome.html` | New dealer signup |
| FB Admin Accepted | `fb_admin_accepted.html` | After accepting FB admin invite |
| First Post Scheduled | `first_post_scheduled.html` | First posts scheduled |
| Post Scheduled | `post_scheduled.html` | Ongoing notifications |
| Content Ready | `content_ready.html` | Monthly content for CONTENT dealers |
| Holiday | `holiday.html` | Seasonal campaigns |

**Template Variables:**
- `{{first_name}}` - Contact first name
- `{{dealer_name}}` - Display name
- `{{email}}` - Contact email

---

## Common Workflows

### Onboard New FULL Dealer

1. Navigate to `/admin/dealer-review`
2. Find dealer in pending list
3. Validate all fields
4. Select best logo
5. Click "Approve"
6. System handles spreadsheet, renders, emails

### Send Batch Render

1. Navigate to `/admin`
2. Enter post number
3. Enter Creatomate template ID
4. Click "Start Batch"
5. Monitor progress via batch status

### Process "Done" Dealers

1. Navigate to `/admin`
2. View "Process Done Emails" section
3. Review dealers marked "Done" in spreadsheet
4. Click "Send" for individual or "Process All"
5. Status updates to "Email Sent"

### Populate Post Copy

1. Navigate to `/admin`
2. Enter post number
3. Type base copy in text area
4. Click variable buttons: {name}, {phone}, {website}
5. Click "Preview" to verify
6. Click "Populate All" to write to spreadsheet

---

## Related Documentation

| File | Purpose |
|------|---------|
| [../engineering/API_REFERENCE.md](../engineering/API_REFERENCE.md) | API endpoints |
| [DEALER_LIFECYCLE.md](DEALER_LIFECYCLE.md) | Status transitions |
| [EMAIL_AUTOMATION.md](EMAIL_AUTOMATION.md) | Email types and triggers |
