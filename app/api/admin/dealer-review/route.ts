/**
 * GET /api/admin/dealer-review - List dealers pending review
 * POST /api/admin/dealer-review - Approve a dealer after review
 *
 * Dealers promoted from CONTENT to FULL need manual review before:
 * - Adding to scheduling spreadsheet
 * - Sending FB Admin Accepted email
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDealers, approveDealer, type FirestoreDealer } from '@/lib/firestore-dealers';
import { addDealerToSpreadsheet, getActivePostsFromSpreadsheet, populatePostCopyForDealer } from '@/lib/google-sheets';
import { sendFbAdminAcceptedEmail, sendOnboardingCompleteEmail } from '@/lib/email';

interface DealerReview {
  dealer_no: string;
  dealer_name: string;
  display_name: string | null;
  distributor_name: string | null;
  contact_name: string | null;
  contact_first_name: string | null;
  contact_email: string | null;
  turnkey_phone: string | null;
  dealer_web_address: string | null;
  creatomate_phone: string | null;
  creatomate_website: string | null;
  creatomate_logo: string | null;
  region: string | null;
  program_status: string;
  review_status: string;
  updated_at: string;
}

// GET - List dealers pending review
export async function GET() {
  try {
    const dealers = await getDealers({ review_status: 'pending_review' });

    return NextResponse.json({
      success: true,
      count: dealers.length,
      dealers,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch dealers' },
      { status: 500 }
    );
  }
}

interface ApproveRequest {
  dealer_no: string;
  display_name: string;
  creatomate_phone: string;
  creatomate_website: string;
  creatomate_logo: string;
  region?: string;
}

// POST - Approve dealer after review (with full automation)
export async function POST(request: NextRequest) {
  try {
    const body: ApproveRequest = await request.json();
    const { dealer_no, display_name, creatomate_phone, creatomate_website, creatomate_logo, region } = body;

    if (!dealer_no) {
      return NextResponse.json(
        { success: false, error: 'dealer_no is required' },
        { status: 400 }
      );
    }

    // Validate required fields (website is optional)
    if (!display_name || !creatomate_phone || !creatomate_logo) {
      return NextResponse.json(
        { success: false, error: 'display_name, creatomate_phone, and creatomate_logo are required (website is optional)' },
        { status: 400 }
      );
    }

    console.log(`[dealer-review] Starting automated onboarding for dealer ${dealer_no}`);

    // 1. Update dealer in Firestore with validated fields (website can be empty)
    await approveDealer(dealer_no, {
      display_name,
      creatomate_phone,
      creatomate_website: creatomate_website || '',
      creatomate_logo,
      region,
    });

    // 2. Add dealer to scheduling spreadsheet
    const spreadsheetResult = await addDealerToSpreadsheet(dealer_no);
    if (!spreadsheetResult.success) {
      throw new Error(`Failed to add to spreadsheet: ${spreadsheetResult.message}`);
    }

    const spreadsheetColumn = spreadsheetResult.column!;
    console.log(`[dealer-review] Added to spreadsheet column ${spreadsheetColumn}`);

    // 3. Get active posts from spreadsheet
    const activePosts = await getActivePostsFromSpreadsheet();
    console.log(`[dealer-review] Found ${activePosts.length} active posts`);

    // 4. Populate post copy for each active post
    const populateResults = [];
    for (const post of activePosts) {
      try {
        const result = await populatePostCopyForDealer(
          dealer_no,
          post.postNumber,
          post.baseCopy,
          post.rowNumber
        );
        populateResults.push({ postNumber: post.postNumber, ...result });
      } catch (error) {
        console.error(`[dealer-review] Failed to populate post ${post.postNumber}:`, error);
        populateResults.push({
          postNumber: post.postNumber,
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successfulPopulates = populateResults.filter(r => r.success).length;
    console.log(`[dealer-review] Populated ${successfulPopulates}/${activePosts.length} posts`);

    // 5. Create render jobs for this ONE dealer (using dealerNo filter)
    const renderResults = [];
    for (const post of activePosts) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/creative/render-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postNumber: post.postNumber,
            templateId: post.templateId,
            dealerNo: dealer_no  // Filter to this one dealer
          })
        });

        const data = await response.json();

        if (response.ok && data.status === 'success') {
          const batchId = data.batches?.[0]?.batchId || '';
          renderResults.push({
            postNumber: post.postNumber,
            success: true,
            batchId,
            message: 'Batch created'
          });
        } else {
          renderResults.push({
            postNumber: post.postNumber,
            success: false,
            batchId: '',
            message: data.error || data.message || 'Failed to create batch'
          });
        }
      } catch (error) {
        console.error(`[dealer-review] Failed to create render batch for post ${post.postNumber}:`, error);
        renderResults.push({
          postNumber: post.postNumber,
          success: false,
          batchId: '',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successfulRenders = renderResults.filter(r => r.success).length;
    console.log(`[dealer-review] Created ${successfulRenders}/${activePosts.length} render batches`);

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
      console.error('[dealer-review] Failed to send Olivia notification:', error);
    }

    // 8. Send FB Admin email to dealer
    const emailResult = await sendFbAdminAcceptedEmail(dealer_no);

    // 9. Build comprehensive response
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

    console.log(`[dealer-review] Onboarding complete for dealer ${dealer_no}`);

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
      { success: false, error: error instanceof Error ? error.message : 'Failed to approve dealer' },
      { status: 500 }
    );
  }
}
