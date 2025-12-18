// app/api/creative/import-dealers/route.ts
// API endpoint to import dealers from CSV data

import { NextRequest, NextResponse } from 'next/server';
import { importDealers, importDealer } from '@/scripts/import-dealers';
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
 * POST /api/creative/import-dealers
 *
 * Import dealers from CSV data
 *
 * Request body:
 * {
 *   dealers: DealerCSVData[],
 *   checkDuplicates?: boolean  // If true, return duplicates instead of importing
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dealers, checkDuplicates = false } = body;

    if (!dealers || !Array.isArray(dealers)) {
      return NextResponse.json(
        { error: 'Missing or invalid dealers array' },
        { status: 400 }
      );
    }

    if (dealers.length === 0) {
      return NextResponse.json(
        { error: 'Dealers array is empty' },
        { status: 400 }
      );
    }

    // If checking duplicates, scan for matches before importing
    if (checkDuplicates) {
      const duplicates: any[] = [];
      const toImport: DealerCSVData[] = [];

      for (const dealer of dealers) {
        // Check for existing dealer by name (case-insensitive)
        const nameQuery = await db
          .collection('businesses')
          .where('businessName', '==', dealer.publicCompanyName.trim())
          .limit(1)
          .get();

        if (!nameQuery.empty) {
          const existing = nameQuery.docs[0];
          duplicates.push({
            imported: dealer,
            existing: {
              id: existing.id,
              ...existing.data(),
            },
            matchType: 'name',
          });
          continue;
        }

        // Check by dealer number if provided
        if (dealer.dealerNo) {
          const dealerNoQuery = await db
            .collection('businesses')
            .where('dealerNo', '==', dealer.dealerNo.trim())
            .limit(1)
            .get();

          if (!dealerNoQuery.empty) {
            const existing = dealerNoQuery.docs[0];
            duplicates.push({
              imported: dealer,
              existing: {
                id: existing.id,
                ...existing.data(),
              },
              matchType: 'dealerNo',
            });
            continue;
          }
        }

        // Not a duplicate, add to import list
        toImport.push(dealer);
      }

      // Import non-duplicates
      let imported = 0;
      for (const dealer of toImport) {
        await importDealer(dealer);
        imported++;
      }

      return NextResponse.json({
        success: true,
        message: duplicates.length > 0
          ? `Imported ${imported} dealer(s). Found ${duplicates.length} duplicate(s).`
          : `Successfully imported ${imported} dealer(s)`,
        imported,
        duplicates,
      });
    }

    // Legacy behavior: import all without checking
    await importDealers(dealers);

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${dealers.length} dealers`,
      count: dealers.length,
    });
  } catch (error) {
    console.error('Error importing dealers:', error);
    return NextResponse.json(
      {
        error: 'Failed to import dealers',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
