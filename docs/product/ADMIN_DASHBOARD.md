# Admin Dashboard

**Last Updated:** February 5, 2026
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

### `/admin/dealer-review` - Dealer Review & Management

**Purpose:** Two sections — approve new FULL dealers and manage existing dealer details.

**Architecture:** Modular component structure:
- `page.tsx` — orchestrator with shared state (~230 lines)
- `components/DealerCard.tsx` — reusable editable form card (~270 lines)
- `components/LogoFinderOverlay.tsx` — shared logo finder modal (~170 lines)
- `components/ManageExistingDealers.tsx` — section 2 container (~270 lines)

#### Section 1: Pending Review

Dealers promoted from CONTENT → FULL appear here for validation.

**Workflow:**
1. Dealer is promoted from CONTENT → FULL (via Gmail webhook or manual)
2. Dealer appears in review queue with `review_status = 'pending_review'`
3. Admin validates:
   - Display name (proper case, "and" not "&")
   - Phone number (formatted: 630-555-1234)
   - Website (domain only: wsminc.net)
   - Logo (select from Brandfetch, website, Facebook)
4. Click "Approve & Add to Spreadsheet"

**Post-Approval Actions:**
After approval, the system automatically:
1. Adds dealer column to scheduling spreadsheet
2. Populates personalized post copy for active posts
3. Creates render batches for all active posts
4. Sends FB Admin Accepted email to dealer
5. Notifies Olivia of new FULL dealer

#### Removed FULL Dealers — Spreadsheet Cleanup

When Excel sync removes FULL dealers, their columns remain in the scheduling spreadsheet. This section lists them so Greg can manually delete the columns.

**Behavior:**
- Auto-loads on page mount alongside pending review
- Shows red-bordered card with dealer name, number, and "Done" button
- Clicking "Done" marks `scheduling_cleanup_done = true` in Firestore, removes from list
- Section auto-hides when no dealers need cleanup
- Also triggered from `/admin` page warning banner after Excel sync

**API:** Uses `GET /api/admin/dealer-review?section=removed-full` to fetch list, `PATCH /api/admin/dealer-review` with `scheduling_cleanup_done: true` to mark done.

#### Section 2: Manage Existing Dealers

View and edit details for all approved FULL dealers.

**Features:**
- **Lazy loading** — dealers load on first click of "Load Existing Dealers" button
- **Search** — filter by dealer name or number (client-side, instant)
- **Default view** — last 10 recently modified dealers (sorted by `updated_at` desc)
- **Show All** — expands to full alphabetical list of all FULL dealers
- **Inline editing** — display name, phone, website, logo URL
- **Save Changes** — updates Firestore only (no re-renders, no spreadsheet sync)
- **Compact cards** — collapsed one-line view, click to expand for editing

**Use Cases:**
- Dealer requests a different logo
- Wrong phone number or website needs correction
- Display name needs adjustment

**API:** Uses `PATCH /api/admin/dealer-review` for field-only updates.

#### Shared: Logo Finder Overlay

Both sections share the same logo finder modal.

**Logo Sources:**
- **Brandfetch** — Professional logo API
- **Website** — Favicon, apple-touch-icon, og:image
- **Facebook** — Profile photo, cover photo

**Logo Save Flow:**
1. Click "Find Logo" on any dealer card
2. Modal searches dealer's website for logos
3. Select a logo → downloads to Google Drive staging folder (PNG conversion)
4. Click "Save Permanently & Auto-Fill" → moves to permanent location, updates dealer field

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
2. Find dealer in pending list (Section 1)
3. Validate display name, phone, website
4. Click "Find Logo" → select best logo → save permanently
5. Click "Approve & Add to Spreadsheet"
6. System handles spreadsheet, post copy, renders, emails

### Edit Existing Dealer Details

1. Navigate to `/admin/dealer-review`
2. Scroll to "Manage Existing Dealers" (Section 2)
3. Click "Load Existing Dealers"
4. Search by name or number, or browse recent
5. Click "Edit" to expand dealer card
6. Update display name, phone, website, or logo
7. Click "Save Changes" (updates Firestore only)

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
