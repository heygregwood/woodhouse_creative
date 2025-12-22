/**
 * GET /api/admin/process-done - Get dealers with "Done" status
 * POST /api/admin/process-done - Process a dealer (send email, update status)
 *
 * This endpoint reads the scheduling spreadsheet and processes dealers
 * whose email status is "Done" - sending the appropriate email and
 * updating the status to "Email Sent"
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import Database from 'better-sqlite3';
import path from 'path';
import { spawn } from 'child_process';

const DB_PATH = path.join(process.cwd(), 'data', 'sqlite', 'creative.db');
const SPREADSHEET_ID = '1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY';

// Row indices (0-based for array access)
const ROW_DEALER_NO = 0;
const ROW_EMAIL_STATUS = 1;
const ROW_FIRST_NAME = 4;
const ROW_EMAIL = 5;

// Column where dealers start (0-based)
const COL_DEALERS_START = 6; // Column G

function getGoogleAuth() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Missing Google credentials');
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: serviceAccountEmail,
      private_key: privateKey.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function colToLetter(colIdx: number): string {
  if (colIdx < 26) {
    return String.fromCharCode(65 + colIdx);
  }
  return String.fromCharCode(64 + Math.floor(colIdx / 26)) + String.fromCharCode(65 + (colIdx % 26));
}

interface DoneDealer {
  dealer_no: string;
  first_name: string;
  email: string;
  column: number;
  col_letter: string;
  has_received_first_post: boolean;
  email_type: 'first_post' | 'post_scheduled';
}

// GET - List dealers with "Done" status
export async function GET() {
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Get spreadsheet data - rows 1-6 (dealer no, status, and contact info)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A1:KU6',
    });

    const rows = response.data.values || [];
    if (rows.length < 2) {
      return NextResponse.json({ success: true, dealers: [], message: 'No data found' });
    }

    const dealerRow = rows[ROW_DEALER_NO] || [];
    const statusRow = rows[ROW_EMAIL_STATUS] || [];
    const firstNameRow = rows[ROW_FIRST_NAME] || [];
    const emailRow = rows[ROW_EMAIL] || [];

    // Get database to check first_post_email_sent
    const db = new Database(DB_PATH, { readonly: true });

    // Find dealers with "Done" status
    const doneDealers: DoneDealer[] = [];

    for (let col = COL_DEALERS_START; col < dealerRow.length; col++) {
      const status = String(statusRow[col] || '').trim().toLowerCase();

      if (status === 'done') {
        let dealerNo = String(dealerRow[col] || '').trim();

        // Handle float formatting from sheets
        try {
          if (dealerNo.includes('.') || dealerNo.toUpperCase().includes('E')) {
            dealerNo = String(parseInt(parseFloat(dealerNo).toString()));
          }
        } catch {
          // Keep original value
        }

        const firstName = String(firstNameRow[col] || '').trim() || 'there';
        const email = String(emailRow[col] || '').trim();

        if (dealerNo && email) {
          // Check database for first_post_email_sent
          const dealer = db.prepare(
            'SELECT first_post_email_sent FROM dealers WHERE dealer_no = ?'
          ).get(dealerNo) as { first_post_email_sent: string | null } | undefined;

          const hasReceivedFirstPost = !!dealer?.first_post_email_sent;

          doneDealers.push({
            dealer_no: dealerNo,
            first_name: firstName,
            email: email,
            column: col,
            col_letter: colToLetter(col),
            has_received_first_post: hasReceivedFirstPost,
            email_type: hasReceivedFirstPost ? 'post_scheduled' : 'first_post',
          });
        }
      }
    }

    db.close();

    return NextResponse.json({
      success: true,
      count: doneDealers.length,
      dealers: doneDealers,
    });
  } catch (error) {
    console.error('Error getting done dealers:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get dealers' },
      { status: 500 }
    );
  }
}

interface ProcessRequest {
  dealer_no: string;
  email_type: 'first_post' | 'post_scheduled';
}

// POST - Process a dealer (send email, update spreadsheet)
export async function POST(request: NextRequest) {
  try {
    const body: ProcessRequest = await request.json();
    const { dealer_no, email_type } = body;

    if (!dealer_no || !email_type) {
      return NextResponse.json(
        { success: false, error: 'dealer_no and email_type are required' },
        { status: 400 }
      );
    }

    // Send email using Python script
    const emailResult = await sendEmail(dealer_no, email_type);

    if (!emailResult.success) {
      return NextResponse.json({
        success: false,
        error: emailResult.error || 'Failed to send email',
      });
    }

    // Update database to track first_post_email_sent
    if (email_type === 'first_post') {
      const db = new Database(DB_PATH);
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE dealers
        SET first_post_email_sent = ?, last_post_email_sent = ?, updated_at = ?
        WHERE dealer_no = ?
      `).run(now, now, now, dealer_no);
      db.close();
    } else {
      const db = new Database(DB_PATH);
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE dealers
        SET last_post_email_sent = ?, updated_at = ?
        WHERE dealer_no = ?
      `).run(now, now, dealer_no);
      db.close();
    }

    return NextResponse.json({
      success: true,
      dealer_no,
      email_type,
      message: `Email sent and status updated to "Email Sent"`,
    });
  } catch (error) {
    console.error('Error processing dealer:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to process dealer' },
      { status: 500 }
    );
  }
}

// Send email using Python script
function sendEmail(dealerNo: string, emailType: 'first_post' | 'post_scheduled'): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const emailScript = path.join(process.cwd(), 'scripts', 'email_sender', 'send_email.py');
    const python = spawn('python3', [emailScript, emailType, dealerNo], {
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
      console.log(`send_email for ${dealerNo} (${emailType}) - exit code: ${code}`);
      console.log(`stdout: ${stdout}`);
      if (stderr) console.log(`stderr: ${stderr}`);

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
