// app/api/creative/toggle-dealers/route.ts
// Utility endpoint to activate/deactivate dealers for testing

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

/**
 * POST /api/creative/toggle-dealers
 *
 * Toggle dealer status for testing purposes
 *
 * Request body:
 * {
 *   action: "test-one" | "activate-all",
 *   testDealerName?: "Woodhouse HVAC" (optional, defaults to Woodhouse HVAC)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, testDealerName } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action parameter' },
        { status: 400 }
      );
    }

    const results = {
      action,
      updated: 0,
      errors: [] as string[],
    };

    // Get all businesses
    const businessesSnapshot = await db.collection('businesses').get();
    const businesses = businessesSnapshot.docs;

    if (action === 'test-one') {
      // Deactivate all except one test dealer
      const testDealer = testDealerName || 'Woodhouse HVAC';

      for (const doc of businesses) {
        const data = doc.data();
        try {
          if (data.businessName === testDealer) {
            // Activate the test dealer
            await doc.ref.update({ status: 'ACTIVE' });
            results.updated++;
            console.log(`✅ Activated: ${data.businessName}`);
          } else {
            // Deactivate all others
            await doc.ref.update({ status: 'INACTIVE' });
            results.updated++;
            console.log(`⏸️  Deactivated: ${data.businessName}`);
          }
        } catch (error) {
          const errorMsg = `Failed to update ${data.businessName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          results.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Test mode enabled. Only "${testDealer}" is active.`,
        results,
        nextStep: 'Go to /creative/render to start a test batch render',
      });

    } else if (action === 'activate-all') {
      // Reactivate all dealers
      for (const doc of businesses) {
        const data = doc.data();
        try {
          await doc.ref.update({ status: 'ACTIVE' });
          results.updated++;
          console.log(`✅ Activated: ${data.businessName}`);
        } catch (error) {
          const errorMsg = `Failed to update ${data.businessName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          results.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'All dealers activated. Ready for full batch render.',
        results,
        nextStep: 'Go to /creative/render to start a full batch render',
      });

    } else {
      return NextResponse.json(
        { error: `Unknown action: ${action}. Use "test-one" or "activate-all"` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error toggling dealers:', error);
    return NextResponse.json(
      {
        error: 'Failed to toggle dealers',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/creative/toggle-dealers
 *
 * Get current dealer status counts
 */
export async function GET() {
  try {
    const businessesSnapshot = await db.collection('businesses').get();
    const businesses = businessesSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().businessName,
      status: doc.data().status,
    }));

    const activeCount = businesses.filter(b => b.status === 'ACTIVE').length;
    const inactiveCount = businesses.filter(b => b.status === 'INACTIVE').length;

    return NextResponse.json({
      total: businesses.length,
      active: activeCount,
      inactive: inactiveCount,
      dealers: businesses,
    });
  } catch (error) {
    console.error('Error getting dealer status:', error);
    return NextResponse.json(
      {
        error: 'Failed to get dealer status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
