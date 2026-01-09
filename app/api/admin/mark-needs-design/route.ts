// POST /api/admin/mark-needs-design - Mark a dealer as needing logo design
import { NextRequest, NextResponse } from 'next/server';
import { markNeedsDesign, getDealers } from '@/lib/firestore-dealers';

export async function POST(request: NextRequest) {
  try {
    const { dealerNo } = await request.json();

    if (!dealerNo) {
      return NextResponse.json({ error: 'Missing dealerNo' }, { status: 400 });
    }

    await markNeedsDesign(dealerNo, true);

    return NextResponse.json({ success: true, dealerNo });
  } catch (error) {
    console.error('[mark-needs-design] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update dealer' },
      { status: 500 }
    );
  }
}

// GET /api/admin/mark-needs-design - Get all dealers needing design
export async function GET() {
  try {
    const allDealers = await getDealers({ logo_needs_design: 1 });

    const dealers = allDealers.map(d => ({
      dealer_no: d.dealer_no,
      display_name: d.display_name || d.dealer_name,
      creatomate_website: d.creatomate_website,
      creatomate_logo: d.creatomate_logo,
    }));

    return NextResponse.json({ dealers });
  } catch (error) {
    console.error('[mark-needs-design] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch dealers' },
      { status: 500 }
    );
  }
}
