/**
 * GET /api/admin/dealer-review - List dealers pending review
 * POST /api/admin/dealer-review - Approve a dealer after review
 *
 * Dealers promoted from CONTENT to FULL need manual review before:
 * - Adding to scheduling spreadsheet
 * - Sending FB Admin Accepted email
 */

import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { spawn } from 'child_process';

const DB_PATH = path.join(process.cwd(), 'data', 'sqlite', 'creative.db');

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
    const db = new Database(DB_PATH);

    const dealers = db.prepare(`
      SELECT
        dealer_no,
        dealer_name,
        display_name,
        distributor_name,
        contact_name,
        contact_first_name,
        contact_email,
        turnkey_phone,
        dealer_web_address,
        creatomate_phone,
        creatomate_website,
        creatomate_logo,
        region,
        program_status,
        review_status,
        updated_at
      FROM dealers
      WHERE review_status = 'pending_review'
      ORDER BY updated_at DESC
    `).all() as DealerReview[];

    db.close();

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

    // Validate required fields
    if (!display_name || !creatomate_phone || !creatomate_website || !creatomate_logo) {
      return NextResponse.json(
        { success: false, error: 'display_name, creatomate_phone, creatomate_website, and creatomate_logo are required' },
        { status: 400 }
      );
    }

    const db = new Database(DB_PATH);

    // Update dealer with validated fields
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE dealers
      SET
        display_name = ?,
        creatomate_phone = ?,
        creatomate_website = ?,
        creatomate_logo = ?,
        region = COALESCE(?, region),
        review_status = 'approved',
        ready_for_automate = 'yes',
        updated_at = ?
      WHERE dealer_no = ?
    `).run(display_name, creatomate_phone, creatomate_website, creatomate_logo, region, now, dealer_no);

    db.close();

    // Add dealer to scheduling spreadsheet
    const spreadsheetResult = await addDealerToSpreadsheet(dealer_no);

    // Send FB Admin Accepted email
    const emailResult = await sendEmail(dealer_no, 'fb_admin_accepted');

    return NextResponse.json({
      success: true,
      dealer_no,
      spreadsheet: spreadsheetResult,
      email: emailResult,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to approve dealer' },
      { status: 500 }
    );
  }
}

// Add dealer to scheduling spreadsheet
async function addDealerToSpreadsheet(dealerNo: string): Promise<{ success: boolean; error?: string; output?: string }> {
  return new Promise((resolve) => {
    const script = path.join(process.cwd(), 'scripts', 'add_dealer_to_spreadsheet.py');
    const python = spawn('python3', [script, dealerNo], {
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
      console.log(`add_dealer_to_spreadsheet for ${dealerNo} - exit code: ${code}`);
      console.log(`stdout: ${stdout}`);
      console.log(`stderr: ${stderr}`);
      if (code !== 0) {
        resolve({ success: false, error: stderr || `Script exited with code ${code}`, output: stdout });
      } else {
        resolve({ success: true, output: stdout });
      }
    });

    python.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

// Send email to a dealer
async function sendEmail(dealerNo: string, emailType: string): Promise<{ success: boolean; error?: string }> {
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
