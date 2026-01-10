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
import { addDealerToSpreadsheet } from '@/lib/google-sheets';
import { sendFbAdminAcceptedEmail } from '@/lib/email';

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

// POST - Approve dealer after review
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

    // Update dealer in Firestore with validated fields (website can be empty)
    await approveDealer(dealer_no, {
      display_name,
      creatomate_phone,
      creatomate_website: creatomate_website || '',
      creatomate_logo,
      region,
    });

    // Add dealer to scheduling spreadsheet
    const spreadsheetResult = await addDealerToSpreadsheet(dealer_no);

    // Send FB Admin Accepted email
    const emailResult = await sendFbAdminAcceptedEmail(dealer_no);

    return NextResponse.json({
      success: true,
      dealer_no,
      spreadsheet: spreadsheetResult,
      email: {
        success: emailResult.success,
        error: emailResult.error,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to approve dealer' },
      { status: 500 }
    );
  }
}
