/**
 * POST /api/admin/send-welcome-email
 *
 * Sends a welcome email to a new dealer.
 * Body: { dealerNo: string, dryRun?: boolean }
 *
 * Uses TypeScript email module (works on Vercel)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dealerNo, dryRun = false } = body;

    if (!dealerNo) {
      return NextResponse.json(
        { success: false, error: 'dealerNo is required' },
        { status: 400 }
      );
    }

    // Send welcome email using TypeScript module
    const result = await sendWelcomeEmail(dealerNo);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[send-welcome-email] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    );
  }
}
