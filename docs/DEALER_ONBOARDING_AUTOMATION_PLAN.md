# Implementation Plan: Automated Dealer Onboarding Workflow

**Status:** Ready for Implementation
**Created:** January 9, 2026
**Last Updated:** January 9, 2026
**Verified Against:** Current codebase on January 9, 2026

**Related Documentation:**
- [DOCUMENTATION_IMPROVEMENT_PLAN.md](DOCUMENTATION_IMPROVEMENT_PLAN.md) - Documentation standards to follow
- [EXCEL_SYNC_REFERENCE.md](EXCEL_SYNC_REFERENCE.md) - Excel column mapping reference
- [CHANGELOG.md](../CHANGELOG.md) - Record implementation changes here
- [README.md](README.md) - Documentation index

---

## Executive Summary

Automate the dealer review and onboarding process to eliminate 95% of manual steps. After approval, the system will automatically handle spreadsheet operations, logo management, post copy population, render batch creation, and email notifications.

**Current workflow:** 15-20 minutes of manual work
**New workflow:** < 1 minute (click "Approve" → done)

---

## Before Implementation

**IMPORTANT:** This implementation involves significant data structure changes. Before coding:

1. Review [DOCUMENTATION_IMPROVEMENT_PLAN.md](DOCUMENTATION_IMPROVEMENT_PLAN.md)
2. Follow the mandatory 6-step documentation workflow from [CLAUDE.md](../CLAUDE.md)
3. Update [CHANGELOG.md](../CHANGELOG.md) with all file changes
4. Add verification dates to modified docs

This prevents documentation drift and reduces bugs like the Excel sync column mapping error.

---

## User Workflow Overview

**Current Daily Process (what stays the same):**
1. Open Excel → Click "Find New Dealers" → Notice new dealers
2. Go to Vercel dashboard → Click "Sync from Excel" (auto-applies)
3. Check for dealers who added us as Facebook admin → Mark as FULL in Excel
4. Sync from Excel again
5. Go to Dealer Review page

**Enhanced Dealer Review (what changes):**
1. Enter/validate display name, phone (website is now optional)
2. Click "Find Logo" (now includes Facebook profile picture)
3. Click "Save Permanently & Auto-Fill" (one-click logo save with URL auto-population)
4. Click "Approve & Add to Spreadsheet"
5. **System automatically:** Adds to spreadsheet, populates post copy, creates render jobs, sends emails
6. Done! Olivia gets notification email when ready to schedule.

---

## Requirements

### A. Make Website Field Optional ✅ Simple
**Why:** Many dealers don't have websites
**Change:** Remove validation checks in UI and API

### B. Add Facebook Profile Picture to Logo Search ✅ Simple
**Why:** Facebook business profile pictures are often high quality
**How:** Use public Graph API endpoint (no auth needed)

### C. One-Click Logo Save & Auto-Populate ⚠️ Medium
**Why:** Current workflow requires 6 manual steps
**How:** New API endpoint to move from staging to permanent folder + auto-fill form

### D. Automatic Post-Approval Actions 🔴 Complex
**Why:** Eliminate forgetting steps, reduce onboarding time
**How:** Orchestrate multiple async operations with error handling

---

## Implementation Phases

### Phase 1: Foundation (Requirements A & B)

#### 1.1 Make Website Optional

**File:** `/app/admin/dealer-review/page.tsx`
**Line:** 217
**Change:**
```typescript
// BEFORE
if (!dealer.edited_display_name || !dealer.edited_phone || !dealer.edited_website || !dealer.edited_logo)

// AFTER
if (!dealer.edited_display_name || !dealer.edited_phone || !dealer.edited_logo)
```

**File:** `/app/api/admin/dealer-review/route.ts`
**Line:** 75
**Change:**
```typescript
// BEFORE
if (!display_name || !creatomate_phone || !creatomate_website || !creatomate_logo)

// AFTER
if (!display_name || !creatomate_phone || !creatomate_logo)
```

**Impact:** Website can be blank during approval, will use empty string in templates

---

#### 1.2 Add Facebook Profile Picture

**File:** `/app/api/admin/fetch-logos/route.ts`
**Location:** After line 234 (after website scraping, before Google favicon)

**New code:**
```typescript
// 4. Facebook Page Profile Picture (if facebook_page_id exists)
if (dealerData.facebook_page_id) {
  try {
    const fbPictureUrl = `https://graph.facebook.com/${dealerData.facebook_page_id}/picture?height=1000&width=1000&type=large`;
    const fbLogo = await fetchImageInfo(fbPictureUrl, 'facebook');
    if (fbLogo) {
      results.push(fbLogo);
      console.log(`[fetch-logos] Found Facebook profile picture (${fbLogo.width}x${fbLogo.height})`);
    }
  } catch (error) {
    console.error('[fetch-logos] Failed to fetch Facebook profile picture:', error);
  }
}
```

**Additional change:** Query Firestore for dealer `facebook_page_id` when `dealerNo` parameter provided

---

### Phase 2: One-Click Logo Save (Requirement C)

#### 2.1 New API Endpoint

**File:** `/app/api/admin/save-logo-permanent/route.ts` (NEW)

**Purpose:** Move logo from staging to permanent Logos folder and return shareable URL

**Implementation:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const STAGING_FOLDER_ID = process.env.GOOGLE_DRIVE_LOGOS_STAGING_FOLDER_ID || '';
const PERMANENT_FOLDER_ID = '1Vht1Dlh-IbyFpxvACbLRN-bVNSRTsrex'; // Logos folder

export async function POST(request: NextRequest) {
  const { stagingFileName, dealerNo } = await request.json();

  // 1. Find file in staging folder by name
  // 2. Move file to permanent Logos folder
  // 3. Set permissions to "anyone with link can view"
  // 4. Generate shareable URL
  // 5. Return { success: true, logoUrl: "https://drive.google.com/file/d/{fileId}/view?usp=sharing" }
}
```

**Uses existing:** `lib/google-drive.ts` functions (`moveFile`, Drive API permissions)

---

#### 2.2 UI Enhancement

**File:** `/app/admin/dealer-review/page.tsx`
**Location:** After logo saved to staging (around line 200)

**Add button:**
```typescript
{logoOverlay.savedToStaging && (
  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
    <p className="text-sm text-green-800 mb-3">
      ✓ Saved to staging folder. Choose an option:
    </p>
    <div className="flex gap-2">
      <button
        onClick={() => saveLogoPermanently()}
        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
      >
        Save Permanently & Auto-Fill
      </button>
      <button
        onClick={() => setLogoOverlay(null)}
        className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400"
      >
        Download Another
      </button>
    </div>
  </div>
)}
```

**New handler:**
```typescript
const saveLogoPermanently = async () => {
  const response = await fetch('/api/admin/save-logo-permanent', {
    method: 'POST',
    body: JSON.stringify({
      stagingFileName: logoOverlay.savedToStaging,
      dealerNo: logoOverlay.dealerNo
    })
  });

  const data = await response.json();

  if (data.success) {
    // Auto-populate logo field
    updateField(logoOverlay.dealerNo, 'edited_logo', data.logoUrl);
    setLogoOverlay(null);
  }
};
```

---

### Phase 3: Automatic Post-Approval Actions (Requirement D)

#### 3.1 New Helper Functions in `lib/google-sheets.ts`

**Function 1: Get Active Posts from Spreadsheet**
```typescript
export async function getActivePostsFromSpreadsheet(): Promise<Array<{
  postNumber: number;
  templateId: string;
  baseCopy: string;
}>> {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // Read columns A, B, C from row 13 onwards
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Sheet1!A13:C1000'
  });

  const rows = response.data.values || [];
  const posts = [];

  for (const row of rows) {
    const postNumber = parseInt(row[0]);
    const templateId = row[1]?.trim();
    const baseCopy = row[2]?.trim();

    if (!isNaN(postNumber) && templateId && baseCopy) {
      posts.push({ postNumber, templateId, baseCopy });
    }
  }

  return posts;
}
```

**Function 2: Populate Post Copy for Single Dealer**
```typescript
export async function populatePostCopyForDealer(
  dealerNo: string,
  postNumber: number,
  baseCopy: string
): Promise<{ success: boolean; message: string }> {
  // Read spreadsheet to get dealer data and find dealer column
  // Replace {phone}, {website}, {name} variables in baseCopy
  // Write personalized copy to dealer's column at post row
  // Return success/failure
}
```

**Function 3: Create Single-Dealer Render Batch**
```typescript
export async function createSingleDealerRenderBatch(
  dealerNo: string,
  postNumber: number,
  templateId: string
): Promise<{ success: boolean; batchId: string; message: string }> {
  const response = await fetch('/api/creative/render-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      postNumber,
      templateId,
      dealerNo  // NEW parameter (enables single-dealer filtering)
    })
  });

  // Return batch ID for tracking
}
```

---

#### 3.2 Modify Render Batch API to Support Single Dealer

**File:** `/app/api/creative/render-batch/route.ts`

**Change:** Add optional `dealerNo` parameter to request body

**Lines 78-90** (dealer query):
```typescript
// BEFORE
const dealers = db.prepare(`
  SELECT dealer_no, display_name, creatomate_phone, creatomate_website, creatomate_logo
  FROM dealers
  WHERE program_status = 'FULL'
    AND ready_for_automate = 'yes'
    AND creatomate_logo IS NOT NULL
`).all() as Dealer[];

// AFTER
let query = `
  SELECT dealer_no, display_name, creatomate_phone, creatomate_website, creatomate_logo
  FROM dealers
  WHERE program_status = 'FULL'
    AND ready_for_automate = 'yes'
    AND creatomate_logo IS NOT NULL
`;

const params: string[] = [];

// NEW: Filter to single dealer if provided
if (body.dealerNo) {
  query += ` AND dealer_no = ?`;
  params.push(body.dealerNo);
}

const dealers = db.prepare(query).all(...params) as Dealer[];
```

---

#### 3.3 New Email Template for Olivia

**File:** `/templates/emails/onboarding_complete.html` (NEW)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>New Dealer Onboarded</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #5378a8;">New Dealer Onboarded: {{dealer_name}}</h2>

  <p>Dealer #{{dealer_no}} has been approved and automated onboarding is complete.</p>

  <h3>Summary</h3>
  <ul>
    <li>Added to scheduling spreadsheet (column {{spreadsheet_column}})</li>
    <li>Post copy populated for {{posts_count}} active posts</li>
    <li>Render batches created for {{posts_count}} posts</li>
    <li>FB Admin email sent to dealer</li>
  </ul>

  <h3>Estimated Completion</h3>
  <p>All renders should complete in approximately <strong>{{estimated_completion}}</strong>.</p>

  <h3>Quick Links</h3>
  <ul>
    <li><a href="{{spreadsheet_url}}">View in Scheduling Spreadsheet</a></li>
    <li><a href="{{drive_folder_url}}">Open Dealer's Drive Folder</a></li>
  </ul>

  <p>The dealer will be notified when their first post is scheduled.</p>

  <hr>
  <p style="font-size: 12px; color: #666;">
    Automated by Woodhouse Creative System
  </p>
</body>
</html>
```

---

#### 3.4 New Email Function in `lib/email.ts`

```typescript
export async function sendOnboardingCompleteEmail({
  dealerNo,
  dealerName,
  postsCount,
  estimatedCompletion,
  spreadsheetColumn,
}: {
  dealerNo: string;
  dealerName: string;
  postsCount: number;
  estimatedCompletion: string;
  spreadsheetColumn: string;
}): Promise<EmailResult> {
  const variables = {
    dealer_no: dealerNo,
    dealer_name: dealerName,
    posts_count: String(postsCount),
    estimated_completion: estimatedCompletion,
    drive_folder_url: `https://drive.google.com/drive/folders/1QwyyE9Pq-p8u-TEz7B5nC-14BERpDPmv`,
    spreadsheet_url: `https://docs.google.com/spreadsheets/d/1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY/edit#gid=0&range=${spreadsheetColumn}1`,
    spreadsheet_column: spreadsheetColumn,
  };

  const template = loadTemplate('onboarding_complete');
  const htmlBody = renderTemplate(template, variables);

  const subject = `New Dealer Onboarded: ${dealerName} (#${dealerNo})`;

  return sendEmail('oliviab731@gmail.com', subject, htmlBody);
}
```

---

#### 3.5 Orchestrate Post-Approval Flow

**File:** `/app/api/admin/dealer-review/route.ts`
**Lines 62-112** (POST handler)

**Replace with:**
```typescript
export async function POST(request: NextRequest) {
  const { dealer_no, display_name, creatomate_phone, creatomate_website, creatomate_logo, region } =
    await request.json();

  // Validation
  if (!dealer_no || !display_name || !creatomate_phone || !creatomate_logo) {
    return NextResponse.json(
      { error: 'Missing required fields (display_name, phone, logo required; website optional)' },
      { status: 400 }
    );
  }

  try {
    // 1. Update dealer in Firestore
    await approveDealer(dealer_no, {
      display_name,
      creatomate_phone,
      creatomate_website: creatomate_website || '',  // Allow blank
      creatomate_logo,
      region,
    });

    // 2. Add to scheduling spreadsheet
    const spreadsheetResult = await addDealerToSpreadsheet(dealer_no);
    if (!spreadsheetResult.success) {
      throw new Error(`Failed to add to spreadsheet: ${spreadsheetResult.message}`);
    }

    const spreadsheetColumn = spreadsheetResult.column!;

    // 3. Get active posts from spreadsheet
    const activePosts = await getActivePostsFromSpreadsheet();

    // 4. Populate post copy for each active post
    const populateResults = [];
    for (const post of activePosts) {
      try {
        const result = await populatePostCopyForDealer(dealer_no, post.postNumber, post.baseCopy);
        populateResults.push({ postNumber: post.postNumber, ...result });
      } catch (error) {
        console.error(`Failed to populate post ${post.postNumber}:`, error);
        populateResults.push({
          postNumber: post.postNumber,
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // 5. Create render jobs for this ONE dealer
    const renderResults = [];
    for (const post of activePosts) {
      try {
        const result = await createSingleDealerRenderBatch(dealer_no, post.postNumber, post.templateId);
        renderResults.push({ postNumber: post.postNumber, ...result });
      } catch (error) {
        console.error(`Failed to create render batch for post ${post.postNumber}:`, error);
        renderResults.push({
          postNumber: post.postNumber,
          success: false,
          batchId: '',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // 6. Calculate estimated completion time
    const avgRenderTime = 2; // minutes per post
    const estimatedMinutes = activePosts.length * avgRenderTime;
    const estimatedCompletion = estimatedMinutes < 60
      ? `${estimatedMinutes} minutes`
      : `${Math.round(estimatedMinutes / 60)} hour${estimatedMinutes >= 120 ? 's' : ''}`;

    // 7. Send notification email to Olivia
    let oliviaEmailSuccess = false;
    try {
      const oliviaResult = await sendOnboardingCompleteEmail({
        dealerNo: dealer_no,
        dealerName: display_name,
        postsCount: activePosts.length,
        estimatedCompletion,
        spreadsheetColumn,
      });
      oliviaEmailSuccess = oliviaResult.success;
    } catch (error) {
      console.error('Failed to send Olivia notification:', error);
    }

    // 8. Send FB Admin email to dealer
    const emailResult = await sendFbAdminAcceptedEmail(dealer_no);

    // 9. Build comprehensive response
    const successfulPopulates = populateResults.filter(r => r.success).length;
    const successfulRenders = renderResults.filter(r => r.success).length;
    const warnings = [];

    if (successfulPopulates < activePosts.length) {
      warnings.push(`${activePosts.length - successfulPopulates} post(s) failed to populate`);
    }
    if (successfulRenders < activePosts.length) {
      warnings.push(`${activePosts.length - successfulRenders} render batch(es) failed`);
    }
    if (!oliviaEmailSuccess) {
      warnings.push('Notification email to Olivia failed');
    }
    if (!emailResult.success) {
      warnings.push('FB Admin email to dealer failed');
    }

    return NextResponse.json({
      success: true,
      dealer_no,
      spreadsheet: { success: true, column: spreadsheetColumn },
      postsPopulated: successfulPopulates,
      postPopulateErrors: populateResults.filter(r => !r.success),
      renderBatches: renderResults.filter(r => r.success).map(r => r.batchId),
      renderBatchErrors: renderResults.filter(r => !r.success),
      email: { success: emailResult.success },
      oliviaEmail: { success: oliviaEmailSuccess },
      warnings,
      estimatedCompletion,
    });
  } catch (error) {
    console.error('[dealer-review] Error approving dealer:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve dealer' },
      { status: 500 }
    );
  }
}
```

---

#### 3.6 Update UI Success Message

**File:** `/app/admin/dealer-review/page.tsx`
**Location:** After approval success (around line 230)

**Enhanced message:**
```typescript
{approvalResult && (
  <div className={`p-4 rounded-lg ${approvalResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
    {approvalResult.success ? (
      <>
        <p className="font-semibold text-green-800">
          ✓ Approved! Spreadsheet: Added (column {approvalResult.spreadsheet.column})
        </p>
        <ul className="text-sm text-green-700 mt-2 ml-6 list-disc">
          <li>{approvalResult.postsPopulated} post(s) populated</li>
          <li>{approvalResult.renderBatches.length} render batch(es) created</li>
          <li>Emails sent</li>
        </ul>
        <p className="text-sm text-green-700 mt-2">
          Olivia has been notified. Renders will complete in ~{approvalResult.estimatedCompletion}.
        </p>
        {approvalResult.warnings && approvalResult.warnings.length > 0 && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm font-medium text-yellow-800">⚠ Warnings:</p>
            <ul className="text-sm text-yellow-700 ml-4 list-disc">
              {approvalResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}
      </>
    ) : (
      <p className="text-red-800">{approvalResult.error}</p>
    )}
  </div>
)}
```

---

## Error Handling Strategy

### Failure Scenarios

**1. Spreadsheet add fails**
- **Impact:** Can't proceed with automation
- **Strategy:** Fail fast, return error to user
- **Recovery:** User can retry approval

**2. Post copy population fails (partial)**
- **Impact:** Some posts missing personalized copy
- **Strategy:** Log errors, continue with other posts
- **Recovery:** User can manually populate via dashboard

**3. Render batch creation fails (partial)**
- **Impact:** Some videos won't be created
- **Strategy:** Log errors, continue with other batches
- **Recovery:** User can manually trigger from dashboard

**4. Email fails (Olivia or dealer)**
- **Impact:** No notification sent
- **Strategy:** Log error, mark as warning
- **Recovery:** Can be sent manually

### Rollback Plan
- No automatic rollback (Firestore updates are intentional)
- User sees comprehensive result with warnings
- Can manually fix partial failures

---

## Testing Strategy

### Unit Testing

**Test dealer:** `99999999` (add to blocked dealers list)

1. **Website optional**
   - Approve with blank website → verify no error
   - Check spreadsheet has empty cell for website

2. **Facebook logo**
   - Call `/api/admin/fetch-logos?dealerNo=10122026`
   - Verify "facebook" source in results

3. **Logo permanent save**
   - Save test logo to staging
   - Call `/api/admin/save-logo-permanent`
   - Verify file moved and URL returned

4. **Get active posts**
   - Call `getActivePostsFromSpreadsheet()`
   - Verify returns current posts with template IDs

5. **Single dealer render**
   - Create batch with `dealerNo: "99999999"`
   - Verify only 1 job created (not 124)

6. **Onboarding email**
   - Call `sendOnboardingCompleteEmail()`
   - Verify email sent to oliviab731@gmail.com

### Integration Testing

**End-to-end approval:**
1. Create test dealer with `review_status: "pending_review"`
2. Open `/admin/dealer-review`
3. Fill form (skip website)
4. Approve
5. Verify:
   - Dealer in spreadsheet
   - Post copy populated
   - Render jobs in Firestore
   - Emails sent
   - Success message shows details

---

## Files to Modify/Create

### New Files
1. `/app/api/admin/save-logo-permanent/route.ts` - Logo permanent save API
2. `/templates/emails/onboarding_complete.html` - Olivia notification template

### Modified Files
1. `/app/admin/dealer-review/page.tsx` - Remove website validation, add logo save button, enhanced success message
2. `/app/api/admin/dealer-review/route.ts` - Orchestrate post-approval automation
3. `/app/api/admin/fetch-logos/route.ts` - Add Facebook profile picture source
4. `/app/api/creative/render-batch/route.ts` - Add dealerNo parameter for single-dealer filtering
5. `/lib/google-sheets.ts` - Add 3 new helper functions
6. `/lib/email.ts` - Add `sendOnboardingCompleteEmail()` function

---

## Deployment Plan

1. **Local testing** (localhost:3000)
   - Test all phases with test dealer
   - Verify no errors
   - User confirms: "tests pass, push it"

2. **Push to Preview**
   ```bash
   ga && git commit -m "Automate dealer onboarding workflow" && gpush
   ```

3. **Preview testing**
   - Test approval with test dealer
   - Verify Firestore, emails, renders

4. **Production**
   - User manually promotes via Vercel dashboard

---

## Success Metrics

- Onboarding time: 15 minutes → < 1 minute
- Manual steps: 10+ → 1 (click "Approve")
- Error rate: Reduced (no forgotten steps)
- Olivia gets immediate notification with all details

---

## Verification Checklist

After implementation:

- [ ] Website field can be blank during approval
- [ ] Facebook profile picture appears in logo search
- [ ] "Save Permanently & Auto-Fill" button works and auto-populates URL
- [ ] Approval creates spreadsheet column with metadata
- [ ] Post copy populated for all active posts
- [ ] Render jobs created in Firestore (check with test dealer)
- [ ] Olivia receives email with all details
- [ ] Dealer receives FB Admin email
- [ ] Success message shows comprehensive results
- [ ] Warnings appear for partial failures
- [ ] No errors in console
- [ ] Test dealer blocked from real emails

---

## Post-Deployment Documentation

**MANDATORY** (See [CLAUDE.md](../CLAUDE.md) Documentation Updates workflow):

1. **Update CLAUDE.md:**
   - Section: Admin Dashboard Pages → /admin/dealer-review
   - Add automated workflow description
   - Update Common Tasks section
   - Note: Website is optional
   - Document all automatic actions (spreadsheet, post copy, renders, emails)

2. **Update CHANGELOG.md:**
   - Add entry with format: `[2026-01-XX] - Dealer Onboarding Automation`
   - List all files changed with line numbers
   - Include verification steps performed
   - Note impact: Reduces onboarding from 15 min to <1 min

3. **Verify documentation matches code:**
   - Read actual code → Read updated docs → Compare (3-step workflow)
   - Spot-check: Pick random feature, verify documented correctly
   - Update verification dates on all modified docs

4. **Update related docs:**
   - [DATABASE.md](DATABASE.md) - If new fields added
   - [README.md](README.md) - Update if new critical docs created
