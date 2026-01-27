/**
 * GET /api/admin/dealer-review - List dealers pending review or existing approved dealers
 * POST /api/admin/dealer-review - Approve a dealer after review (full automation)
 * PATCH /api/admin/dealer-review - Update dealer fields only (no automation)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDealers, approveDealer, getDealer, updateDealer } from '@/lib/firestore-dealers';
import { addDealerToSpreadsheet, getActivePostsFromSpreadsheet, populatePostCopyForDealer } from '@/lib/google-sheets';
import { sendFbAdminAcceptedEmail, sendOnboardingCompleteEmail } from '@/lib/email';
import { createRenderBatch, createRenderJob } from '@/lib/renderQueue';

// GET - List dealers by section
// ?section=pending (default) - dealers with review_status='pending_review'
// ?section=existing - all FULL dealers with ready_for_automate='yes'
export async function GET(request: NextRequest) {
  try {
    const section = request.nextUrl.searchParams.get('section') || 'pending';

    if (section === 'existing') {
      const dealers = await getDealers({
        program_status: 'FULL',
        ready_for_automate: 'yes',
      });

      // Sort by updated_at descending (most recently modified first)
      dealers.sort((a, b) => {
        const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return bTime - aTime;
      });

      return NextResponse.json({
        success: true,
        count: dealers.length,
        dealers,
      });
    }

    // Default: pending review
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

// PATCH - Update dealer fields only (no automation pipeline)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { dealer_no, display_name, creatomate_phone, creatomate_website, creatomate_logo } = body;

    if (!dealer_no) {
      return NextResponse.json(
        { success: false, error: 'dealer_no is required' },
        { status: 400 }
      );
    }

    // Build partial update from provided fields only
    const updates: Record<string, string> = {};
    const updatedFields: string[] = [];

    if (display_name !== undefined) {
      updates.display_name = display_name;
      updatedFields.push('display_name');
    }
    if (creatomate_phone !== undefined) {
      updates.creatomate_phone = creatomate_phone;
      updatedFields.push('creatomate_phone');
    }
    if (creatomate_website !== undefined) {
      updates.creatomate_website = creatomate_website;
      updatedFields.push('creatomate_website');
    }
    if (creatomate_logo !== undefined) {
      updates.creatomate_logo = creatomate_logo;
      updatedFields.push('creatomate_logo');
    }

    if (updatedFields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    await updateDealer(dealer_no, updates);
    console.log(`[dealer-review] Updated fields for ${dealer_no}: ${updatedFields.join(', ')}`);

    return NextResponse.json({
      success: true,
      dealer_no,
      updated_fields: updatedFields,
    });
  } catch (error: unknown) {
    console.error('[dealer-review] Error updating dealer:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update dealer' },
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

    // 5. Create render jobs for this ONE dealer (direct function call, no fetch)
    const renderResults = [];

    // Get dealer info for render job
    const dealer = await getDealer(dealer_no);
    if (!dealer) {
      throw new Error(`Dealer ${dealer_no} not found after approval`);
    }

    for (const post of activePosts) {
      try {
        // Create batch for this post
        const batchId = await createRenderBatch({
          postNumber: post.postNumber,
          templateId: post.templateId,
          totalJobs: 1,  // Just this one dealer
          createdBy: 'dealer-review',
        });

        // Create render job for this dealer
        await createRenderJob({
          batchId,
          businessId: dealer_no,
          businessName: display_name,
          postNumber: post.postNumber,
          templateId: post.templateId,
        });

        renderResults.push({
          postNumber: post.postNumber,
          success: true,
          batchId,
          message: 'Batch created'
        });
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
