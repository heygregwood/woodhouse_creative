/**
 * GET /api/admin/sync-excel - Preview changes from Excel (auto-applies if changes found)
 * POST /api/admin/sync-excel - Apply changes from Excel
 *
 * Syncs dealers from Allied Excel file to SQLite database.
 * Uses Microsoft Graph API to read Excel directly from SharePoint/OneDrive.
 * Detects new dealers, removed dealers, and field updates.
 */

import { NextResponse } from 'next/server';
import { isDealerBlocked } from '@/lib/blocked-dealers';
import { syncFromExcel, type SyncChanges, type DealerChange } from '@/lib/sync-excel';
import { sendWelcomeEmail, sendFbAdminAcceptedEmail, type EmailResult } from '@/lib/email';

// Send email to a dealer using TypeScript email module
async function sendEmail(dealerNo: string, emailType: 'welcome' | 'fb_admin_accepted'): Promise<{ success: boolean; error?: string }> {
  try {
    let result: EmailResult;
    if (emailType === 'welcome') {
      result = await sendWelcomeEmail(dealerNo);
    } else {
      result = await sendFbAdminAcceptedEmail(dealerNo);
    }

    if (result.success) {
      return { success: true };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Email failed',
    };
  }
}

// Helper to check if dealer was promoted to FULL (from CONTENT or NEW)
function wasPromotedToFull(dealer: DealerChange): boolean {
  if (!dealer.changes) return false;
  return dealer.changes.some(change => {
    return change.field === 'program_status' &&
           change.new === 'FULL' &&
           (change.old === 'CONTENT' || change.old === 'NEW' || !change.old);
  });
}

// GET - Check for changes, auto-apply ALL changes, and send appropriate emails
export async function GET() {
  try {
    // Use TypeScript implementation with Microsoft Graph API
    // This works on both localhost and Vercel production
    const { changes } = await syncFromExcel(false); // Dry run first

    const hasNewDealers = changes.new && changes.new.length > 0;
    const hasUpdates = changes.updated && changes.updated.length > 0;
    const hasRemovals = changes.removed && changes.removed.length > 0;

    // If there are any changes, auto-apply them
    if (hasNewDealers || hasUpdates || hasRemovals) {
      // Apply the changes using TypeScript implementation
      await syncFromExcel(true);

      const emailResults: Array<{ dealer_no: string; email_type: string; success: boolean; error?: string }> = [];
      const blockedDealers: string[] = [];

      // Send welcome emails to new dealers (skip blocked dealers)
      // Rate limited to stay under Resend's 2 req/sec limit
      if (changes.new) {
        for (let i = 0; i < changes.new.length; i++) {
          const dealer = changes.new[i];
          // Skip blocked dealers (test accounts, etc.)
          if (isDealerBlocked(dealer.dealer_no)) {
            blockedDealers.push(dealer.dealer_no);
            continue;
          }
          const emailResult = await sendEmail(dealer.dealer_no, 'welcome');
          emailResults.push({
            dealer_no: dealer.dealer_no,
            email_type: 'welcome',
            ...emailResult,
          });
          // Wait 600ms between emails to stay under 2 req/sec limit
          if (i < changes.new.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 600));
          }
        }
      }

      // Count dealers needing review:
      // 1. Dealers promoted from CONTENT/NEW to FULL
      // 2. New dealers added with FULL status
      const pendingReviewDealers: string[] = [];

      // Check updated dealers for promotions
      if (changes.updated) {
        for (const dealer of changes.updated) {
          if (wasPromotedToFull(dealer)) {
            pendingReviewDealers.push(dealer.dealer_no);
          }
        }
      }

      // Check new dealers for FULL status
      if (changes.new) {
        for (const dealer of changes.new) {
          if (dealer.program_status === 'FULL') {
            pendingReviewDealers.push(dealer.dealer_no);
          }
        }
      }

      return NextResponse.json({
        success: true,
        changes: {
          new: changes.new,
          removed: changes.removed,
          updated: changes.updated,
          unchanged: changes.unchanged.length,
        },
        autoApplied: true,
        emailsSent: emailResults.filter(r => r.success).length,
        emailsFailed: emailResults.filter(r => !r.success).length,
        emailResults,
        pendingReviewCount: pendingReviewDealers.length,
        pendingReviewDealers,
        blockedDealersSkipped: blockedDealers,
      });
    }

    // No changes - return the preview
    return NextResponse.json({
      success: true,
      changes: {
        new: changes.new,
        removed: changes.removed,
        updated: changes.updated,
        unchanged: changes.unchanged.length,
      },
      autoApplied: false,
      emailsSent: 0,
      emailsFailed: 0,
      emailResults: [],
      pendingReviewCount: 0,
      pendingReviewDealers: [],
      blockedDealersSkipped: [],
    });
  } catch (error) {
    console.error('[sync-excel] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

// POST - Apply changes and send welcome emails to new dealers
export async function POST() {
  try {
    // Use TypeScript implementation with Microsoft Graph API
    const { changes } = await syncFromExcel(true); // Apply changes

    const emailResults: Array<{ dealer_no: string; success: boolean; error?: string }> = [];
    const blockedDealers: string[] = [];

    // If successful and there are new dealers, send welcome emails
    if (changes.new && changes.new.length > 0) {
      for (let i = 0; i < changes.new.length; i++) {
        const dealer = changes.new[i];
        // Skip blocked dealers (test accounts, etc.)
        if (isDealerBlocked(dealer.dealer_no)) {
          blockedDealers.push(dealer.dealer_no);
          continue;
        }
        const emailResult = await sendEmail(dealer.dealer_no, 'welcome');
        emailResults.push({
          dealer_no: dealer.dealer_no,
          ...emailResult,
        });
        // Wait 600ms between emails to stay under 2 req/sec limit
        if (i < changes.new.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
    }

    return NextResponse.json({
      success: true,
      changes: {
        new: changes.new,
        removed: changes.removed,
        updated: changes.updated,
        unchanged: changes.unchanged.length,
      },
      emailsSent: emailResults.filter(r => r.success).length,
      emailsFailed: emailResults.filter(r => !r.success).length,
      emailResults,
      blockedDealersSkipped: blockedDealers,
    });
  } catch (error) {
    console.error('[sync-excel] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
