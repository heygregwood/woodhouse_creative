/**
 * GET /api/admin/sync-excel - Preview changes from Excel
 * POST /api/admin/sync-excel - Apply changes from Excel
 *
 * Syncs dealers from Allied Excel file to SQLite database.
 * Detects new dealers, removed dealers, and field updates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { isDealerBlocked } from '@/lib/blocked-dealers';
import { syncFromExcel } from '@/lib/sync-excel';

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'sync_from_excel.py');

interface SyncResult {
  success: boolean;
  output: string;
  changes?: {
    new: Array<{ dealer_no: string; dealer_name: string; program_status: string }>;
    removed: Array<{ dealer_no: string; dealer_name: string; program_status: string }>;
    updated: Array<{ dealer_no: string; dealer_name: string; changes: string[] }>;
    unchanged: number;
  };
  error?: string;
}

function runPythonScript(args: string[]): Promise<SyncResult> {
  return new Promise((resolve) => {
    const python = spawn('python3', [SCRIPT_PATH, ...args], {
      cwd: process.cwd(),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          output: stdout,
          error: stderr || `Script exited with code ${code}`,
        });
        return;
      }

      // Parse the output to extract change counts
      const changes = parseOutput(stdout);
      resolve({
        success: true,
        output: stdout,
        changes,
      });
    });

    python.on('error', (err) => {
      resolve({
        success: false,
        output: '',
        error: `Failed to run script: ${err.message}`,
      });
    });
  });
}

function parseOutput(output: string): SyncResult['changes'] {
  const changes: SyncResult['changes'] = {
    new: [],
    removed: [],
    updated: [],
    unchanged: 0,
  };

  // Parse NEW DEALERS section
  const newMatch = output.match(/🆕 NEW DEALERS \((\d+)\):([\s\S]*?)(?=\n\n|❌|✏️|📊)/);
  if (newMatch) {
    const lines = newMatch[2].trim().split('\n');
    for (const line of lines) {
      const match = line.match(/(\d+)\s*-\s*(.+?)\s*\((\w+)\)/);
      if (match) {
        changes.new.push({
          dealer_no: match[1],
          dealer_name: match[2].trim(),
          program_status: match[3],
        });
      }
    }
  }

  // Parse REMOVED DEALERS section
  const removedMatch = output.match(/❌ REMOVED DEALERS \((\d+)\):([\s\S]*?)(?=\n\n|✏️|📊)/);
  if (removedMatch) {
    const lines = removedMatch[2].trim().split('\n');
    for (const line of lines) {
      const match = line.match(/(\d+)\s*-\s*(.+?)\s*\((\w+)\)/);
      if (match) {
        changes.removed.push({
          dealer_no: match[1],
          dealer_name: match[2].trim(),
          program_status: match[3],
        });
      }
    }
  }

  // Parse UPDATED DEALERS section
  const updatedMatch = output.match(/✏️\s*UPDATED DEALERS \((\d+)\):([\s\S]*?)(?=\n\n📊|\n📊)/);
  if (updatedMatch) {
    const section = updatedMatch[2].trim();
    const lines = section.split('\n');

    let currentDealer: { dealer_no: string; dealer_name: string; changes: string[] } | null = null;

    for (const line of lines) {
      // Check if this is a dealer line (starts with dealer number)
      const dealerMatch = line.match(/^\s*(\d{8,})\s*-\s*(.+)/);
      if (dealerMatch) {
        // Save previous dealer if exists
        if (currentDealer) {
          changes.updated.push(currentDealer);
        }
        currentDealer = {
          dealer_no: dealerMatch[1],
          dealer_name: dealerMatch[2].trim(),
          changes: [],
        };
      } else if (currentDealer && line.includes('→')) {
        // This is a change line (e.g., "program_status: 'CONTENT' → 'FULL'")
        const changeMatch = line.match(/^\s*(\w+):\s*'?([^']+)'?\s*→\s*'?([^']+)'?/);
        if (changeMatch) {
          currentDealer.changes.push(`${changeMatch[1]}: ${changeMatch[2]} → ${changeMatch[3]}`);
        }
      }
    }

    // Don't forget the last dealer
    if (currentDealer) {
      changes.updated.push(currentDealer);
    }
  }

  // Parse unchanged count
  const unchangedMatch = output.match(/Unchanged:\s*(\d+)/);
  if (unchangedMatch) {
    changes.unchanged = parseInt(unchangedMatch[1]);
  }

  return changes;
}

// GET - Check for changes, auto-apply ALL changes, and send appropriate emails
export async function GET() {
  try {
    // First, do a dry run to see what changes exist
    const { changes } = await syncFromExcel(false);

    const hasNewDealers = changes.new && changes.new.length > 0;
    const hasUpdates = changes.updated && changes.updated.length > 0;
    const hasRemovals = changes.removed && changes.removed.length > 0;

    // If there are any changes, auto-apply them
    if (hasNewDealers || hasUpdates || hasRemovals) {
      // Apply the changes
      await syncFromExcel(true);

      const emailResults: Array<{ dealer_no: string; email_type: string; success: boolean; error?: string }> = [];

      // Send welcome emails to new dealers (skip blocked dealers)
      // Rate limited to stay under Resend's 2 req/sec limit
      const blockedDealers: string[] = [];
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

      // Count dealers promoted to FULL - they need manual review before spreadsheet/email
      const pendingReviewDealers: string[] = [];
      if (changes.updated) {
        for (const dealer of changes.updated) {
          if (wasPromotedToFull(dealer)) {
            // Don't auto-add to spreadsheet or send email
            // These dealers are now marked as pending_review in the database
            pendingReviewDealers.push(dealer.dealer_no);
          }
        }
      }

      return NextResponse.json({
        success: true,
        changes,
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
      changes,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

// Add dealer to scheduling spreadsheet
async function addDealerToSpreadsheet(dealerNo: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const script = path.join(process.cwd(), 'scripts', 'add_dealer_to_spreadsheet.py');
    const python = spawn('python3', [script, dealerNo], {
      cwd: process.cwd(),
      env: { ...process.env },
    });

    let stderr = '';

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        resolve({ success: false, error: stderr || `Script exited with code ${code}` });
      } else {
        resolve({ success: true });
      }
    });

    python.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

// Send email to a dealer
async function sendEmail(dealerNo: string, emailType: 'welcome' | 'fb_admin_accepted'): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const emailScript = path.join(process.cwd(), 'scripts', 'email_sender', 'send_email.py');
    const python = spawn('python3', [emailScript, emailType, dealerNo], {
      cwd: process.cwd(),
      env: { ...process.env },
    });

    let stderr = '';

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        resolve({ success: false, error: stderr || `Email script exited with code ${code}` });
      } else {
        resolve({ success: true });
      }
    });

    python.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

// Helper to check if dealer was promoted to FULL (from CONTENT or NEW)
function wasPromotedToFull(dealer: { changes?: Array<{ field: string; old: string | null; new: string | null }> }): boolean {
  if (!dealer.changes) return false;
  return dealer.changes.some(change => {
    return change.field === 'program_status' &&
           change.new === 'FULL' &&
           (change.old === 'CONTENT' || change.old === 'NEW' || !change.old);
  });
}

// POST - Apply changes and send welcome emails to new dealers
export async function POST() {
  try {
    const { changes } = await syncFromExcel(true);

    // If successful and there are new dealers, send welcome emails
    if (changes.new && changes.new.length > 0) {
      const emailResults: Array<{ dealer_no: string; success: boolean; error?: string }> = [];
      const blockedDealers: string[] = [];

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

      // Add email results to the response
      return NextResponse.json({
        success: true,
        changes,
        emailsSent: emailResults.filter(r => r.success).length,
        emailsFailed: emailResults.filter(r => !r.success).length,
        emailResults,
        blockedDealersSkipped: blockedDealers,
      });
    }

    return NextResponse.json({
      success: true,
      changes,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
