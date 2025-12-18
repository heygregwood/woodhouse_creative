// app/api/creative/resolve-duplicate/route.ts
// API endpoint to resolve duplicate dealers

import { NextRequest, NextResponse } from 'next/server';
import { importDealer } from '@/scripts/import-dealers';
import { db } from '@/lib/firebase';

interface DealerCSVData {
  contactFirstName: string;
  publicCompanyPhone: string;
  publicCompanyName: string;
  publicWebAddress: string;
  logoShareUrl: string;
  dealerNo?: string;
  contactEmail?: string;
}

/**
 * POST /api/creative/resolve-duplicate
 *
 * Resolve a duplicate by either keeping imported or keeping existing
 *
 * Request body:
 * {
 *   imported: DealerCSVData,
 *   existingId: string,
 *   keepImported: boolean  // true = replace existing with imported, false = keep existing
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imported, existingId, keepImported } = body;

    if (!imported || !existingId || typeof keepImported !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    if (keepImported) {
      // Replace existing with imported data
      console.log(`Replacing existing dealer ${existingId} with new data`);

      // Delete the existing record
      await db.collection('businesses').doc(existingId).delete();

      // Import the new data
      await importDealer(imported);

      return NextResponse.json({
        success: true,
        message: `Replaced existing dealer with new data: ${imported.publicCompanyName}`,
      });
    } else {
      // Keep existing, skip imported
      console.log(`Keeping existing dealer ${existingId}, skipping imported`);

      return NextResponse.json({
        success: true,
        message: `Kept existing dealer: ${imported.publicCompanyName}`,
      });
    }
  } catch (error) {
    console.error('Error resolving duplicate:', error);
    return NextResponse.json(
      {
        error: 'Failed to resolve duplicate',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
