# Admin Dashboard

**Last Updated:** January 27, 2026
**URL:** https://woodhouse-creative.vercel.app/admin
**Local:** http://localhost:3000/admin

---

## Overview

The admin dashboard provides tools for managing dealer automation, batch rendering, email sending, post creation, and spreadsheet operations. It is organized into 6 pages by workflow area.

---

## Dashboard Pages

### `/admin` - Overview & Sync

**Features:**

| Section | Purpose |
|---------|---------|
| **Quick Stats** | Dealer counts, post counts, ready status |
| **Excel Sync** | Preview/apply changes from Allied Excel (Microsoft Graph API) |
| **Navigation** | Cards linking to all other admin pages |

**Excel Sync:** Works on both localhost and Vercel via Microsoft Graph API with OAuth2 device code flow.

---

### `/admin/posts` - Post Management

**Features:**
- View existing posts with search/filter and video thumbnails from Google Drive
- Create new posts with one-click workflow (select template, enter copy, auto-renders for all FULL dealers)
- Generate PDF copy deck for CONTENT dealers with video thumbnails (Cloudinary)

**Create Post Workflow:**
1. Select Creatomate template from dropdown
2. Enter post number and base copy with variable placeholders
3. One-click: creates post, adds to spreadsheet, populates personalized copy, triggers batch renders

---

### `/admin/scheduling` - FULL Dealer Operations

**Features:**

| Section | Purpose |
|---------|---------|
| **Dealer Status Table** | View all FULL dealers from scheduling spreadsheet with sorting |
| **Process Done Emails** | Send emails to dealers marked "Done" (auto-detects first_post vs post_scheduled) |
| **Batch Video Render** | Submit post number + template for batch rendering |
| **Populate Post Copy** | Enter base copy with variable picker, populate to all dealer columns |
| **Email Delivery Status** | Track delivered/opened/clicked/bounced status via Resend webhooks |

---

### `/admin/content-dealers` - CONTENT Dealer Operations

**Features:**
- Populate mail merge spreadsheet with CONTENT/NEW dealers from Firestore
- Manage welcome email automation workflow for non-FULL dealers

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
| Onboarding Complete | `onboarding_complete.html` | After dealer onboarding finalized |

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

### Create a New Post

1. Navigate to `/admin/posts`
2. Select Creatomate template
3. Enter post number and base copy
4. Click "Create Post"
5. System creates post, populates copy, triggers batch renders

### Send Batch Render

1. Navigate to `/admin/scheduling`
2. Enter post number
3. Enter Creatomate template ID
4. Click "Start Batch"
5. Monitor progress via batch status

### Process "Done" Dealers

1. Navigate to `/admin/scheduling`
2. View "Process Done Emails" section
3. Review dealers marked "Done" in spreadsheet
4. Click "Send" for individual or "Process All"
5. Status updates to "Email Sent"

### Populate Post Copy

1. Navigate to `/admin/scheduling`
2. Enter post number
3. Type base copy in text area
4. Click variable buttons: {name}, {phone}, {website}
5. Click "Preview" to verify
6. Click "Populate All" to write to spreadsheet

### Generate Copy Deck PDF

1. Navigate to `/admin/posts`
2. Click "Generate Copy Deck"
3. PDF includes video thumbnails (Cloudinary) and personalized copy per dealer

---

## Related Documentation

| File | Purpose |
|------|---------|
| [../engineering/API_REFERENCE.md](../engineering/API_REFERENCE.md) | API endpoints |
| [DEALER_LIFECYCLE.md](DEALER_LIFECYCLE.md) | Status transitions |
| [EMAIL_AUTOMATION.md](EMAIL_AUTOMATION.md) | Email types and triggers |
