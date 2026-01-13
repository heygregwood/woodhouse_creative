# Dealer Lifecycle

**Last Updated:** January 13, 2026

---

## Overview

Dealers progress through distinct statuses as they move from signup to active automation.

---

## Status Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         NEW SIGNUP                              │
│                    (Allied Air enrollment)                      │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                         CONTENT                                 │
│              We create content, they post it                    │
│                                                                 │
│  Fields: dealer_no, dealer_name, contact_email                  │
│  Automation: Monthly content emails only                        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ [Accepts Facebook admin invitation]
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FULL (pending_review)                        │
│              Awaiting admin validation                          │
│                                                                 │
│  Trigger: Gmail webhook detects admin invite accepted           │
│  Fields: review_status = 'pending_review'                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ [Admin validates name, phone, website, logo]
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                         FULL                                    │
│            Ready for full automation                            │
│                                                                 │
│  Fields: ready_for_automate = 'yes', review_status = null       │
│  Automation: Renders, posts, emails                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ [Opts out or is removed by Allied]
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                        REMOVED                                  │
│               Soft deleted, preserved for records               │
│                                                                 │
│  Fields: allied_status = 'REMOVED'                              │
│  Automation: None                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Status Details

### CONTENT (209 dealers)

**Description:** We create social media content for these dealers, but they handle posting themselves.

**What's automated:**
- Monthly content ready emails
- Content download links

**What's manual:**
- Dealer downloads content
- Dealer posts to their Facebook page

**Fields required:**
- `dealer_no` - Allied Air ID
- `dealer_name` - From Allied
- `contact_email` - For sending content

---

### FULL (130 dealers)

**Description:** Full turnkey service. We have Facebook admin access and handle everything.

**What's automated:**
- Video rendering via Creatomate
- Upload to Google Drive
- Post scheduling via Sprout Social
- Email notifications

**Fields required (for `ready_for_automate = 'yes'`):**
- `display_name` - Clean name (proper case)
- `creatomate_phone` - Formatted phone
- `creatomate_website` - Domain only
- `creatomate_logo` - Google Drive URL
- `facebook_page_id` - For posting

---

### REMOVED

**Description:** Dealer opted out or was removed by Allied Air.

**Handling:**
- `allied_status = 'REMOVED'`
- Document preserved for MSA compliance
- Not included in automation
- Column hidden in spreadsheet

---

## Transition Triggers

### CONTENT → FULL

**Automatic (preferred):**
1. Gmail webhook detects "Admin Role" email from Facebook
2. API route `/api/admin/dealer-status` called with `action: 'promote'`
3. Dealer set to `program_status: 'FULL'`, `review_status: 'pending_review'`

**Manual:**
```bash
python3 scripts/update_dealer_status.py --promote --dealer-no 10251015
```

---

### FULL (pending) → FULL (ready)

**Approval via dashboard:**
1. Admin navigates to `/admin/dealer-review`
2. Validates all fields
3. Selects logo
4. Clicks "Approve"

**Result:**
- `review_status` → `null`
- `ready_for_automate` → `'yes'`

---

### FULL → REMOVED

**Automatic:**
1. Excel sync detects dealer removed from Allied spreadsheet
2. Dealer marked `allied_status: 'REMOVED'`

**Manual:**
```bash
# Via API
POST /api/admin/dealer-status { "action": "remove", "dealer_no": "10251015" }

# Via script
python3 scripts/update_dealer_status.py --demote --dealer-no 10251015
```

---

## Counts by Status (Current)

| Status | Count | Description |
|--------|-------|-------------|
| FULL (ready) | 130 | Fully automated |
| FULL (pending) | 0 | Awaiting review |
| CONTENT | 221 | Content only |
| REMOVED | varies | Historical |
| **Total** | **351** | In Firestore |

---

## Email Flow by Status

| Transition | Email Sent |
|------------|------------|
| New signup | Welcome email |
| CONTENT dealer, monthly | Content ready email |
| CONTENT → FULL | FB admin accepted email |
| First posts scheduled | First post scheduled email |
| Ongoing posts | Post scheduled email |

---

## Related Documentation

| File | Purpose |
|------|---------|
| [EMAIL_AUTOMATION.md](EMAIL_AUTOMATION.md) | Email triggers |
| [ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md) | Approval workflow |
| [../engineering/DATA_MODEL.md](../engineering/DATA_MODEL.md) | Field definitions |
