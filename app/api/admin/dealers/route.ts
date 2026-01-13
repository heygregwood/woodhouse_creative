// GET /api/admin/dealers - Fetch dealers from Firestore
// NOTE: Migrated from SQLite to Firestore Jan 2026
import { NextRequest, NextResponse } from 'next/server';
import { getDealers } from '@/lib/firestore-dealers';

export async function GET(request: NextRequest) {
  const filter = request.nextUrl.searchParams.get('filter') || 'not-ready';

  try {
    // Get all FULL dealers from Firestore
    const allDealers = await getDealers();

    let dealers = allDealers.filter(d => d.program_status === 'FULL');

    if (filter === 'not-ready') {
      dealers = dealers.filter(d => !d.ready_for_automate || d.ready_for_automate !== 'yes');
    } else if (filter === 'no-logo') {
      dealers = dealers.filter(d => !d.creatomate_logo || d.creatomate_logo === '');
    } else if (filter === 'round2') {
      // Show dealers with logos updated recently (those from Round 2 that got new selections)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      dealers = dealers.filter(d =>
        d.logo_source &&
        ['brandfetch', 'website', 'favicon'].includes(d.logo_source) &&
        d.updated_at &&
        new Date(d.updated_at) > oneDayAgo
      );
    }

    // Sort by display_name
    dealers.sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));

    // Map to expected response format
    const result = dealers.map(d => ({
      dealer_no: d.dealer_no,
      display_name: d.display_name || '',
      creatomate_website: d.creatomate_website || '',
      creatomate_logo: d.creatomate_logo || '',
      creatomate_phone: d.creatomate_phone || '',
      ready_for_automate: d.ready_for_automate || '',
      logo_source: d.logo_source || '',
    }));

    return NextResponse.json({ dealers: result });
  } catch (error: unknown) {
    console.error('[admin/dealers] Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dealers' },
      { status: 500 }
    );
  }
}
