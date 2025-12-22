/**
 * POST /api/admin/send-batch-emails
 *
 * Sends emails to multiple dealers and updates spreadsheet status.
 * Called when dealers have "Done" status and need "Email Sent" notifications.
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import Database from 'better-sqlite3';
import path from 'path';

const SPREADSHEET_ID = '1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY';
const DB_PATH = path.join(process.cwd(), 'data', 'sqlite', 'creative.db');
const COL_DEALERS_START = 6;

// Row indices (0-indexed)
const ROWS = {
  DEALER_NO: 0,
  STATUS: 1,
  FIRST_NAME: 4,
  EMAIL: 5,
};

interface EmailRequest {
  dealerNumbers: string[];
  emailType: 'post_scheduled' | 'welcome' | 'first_post_scheduled' | 'content_ready';
}

function getGoogleAuth() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Missing Google service account credentials');
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: serviceAccountEmail,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function sendEmail(dealer: {
  dealerNo: string;
  firstName: string;
  email: string;
  displayName: string;
}, emailType: string): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error('RESEND_API_KEY not configured');
    return false;
  }

  if (!dealer.email) {
    console.log(`No email for dealer ${dealer.dealerNo}`);
    return false;
  }

  // Email templates
  const templates: Record<string, { subject: string; getBody: (d: typeof dealer) => string }> = {
    post_scheduled: {
      subject: 'Your Social Media Posts Are Scheduled',
      getBody: (d) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #5378a8; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Woodhouse Social</h1>
          </div>
          <div style="padding: 30px; background-color: #f5f5f5;">
            <p>Hi ${d.firstName || 'there'},</p>
            <p>Great news! Your social media posts for <strong>${d.displayName}</strong> have been scheduled.</p>
            <p>Your posts will go live according to your scheduled calendar. Keep an eye on your Facebook page for engagement!</p>
            <p>If you have any questions, just reply to this email.</p>
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>The Woodhouse Team</strong>
            </p>
          </div>
          <div style="background-color: #c87a3e; padding: 15px; text-align: center;">
            <p style="color: white; margin: 0; font-size: 12px;">
              Woodhouse Agency | Allied Air Turnkey Social Media Program
            </p>
          </div>
        </div>
      `,
    },
    welcome: {
      subject: 'Welcome to Woodhouse Social',
      getBody: (d) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #5378a8; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Welcome to Woodhouse Social!</h1>
          </div>
          <div style="padding: 30px; background-color: #f5f5f5;">
            <p>Hi ${d.firstName || 'there'},</p>
            <p>Welcome to the Allied Air Turnkey Social Media Program! We're excited to have <strong>${d.displayName}</strong> on board.</p>
            <p>Here's what happens next:</p>
            <ol>
              <li>We'll create custom video content for your business</li>
              <li>Posts will be scheduled to your Facebook page</li>
              <li>You'll receive notifications when posts go live</li>
            </ol>
            <p>If you have any questions, just reply to this email.</p>
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>The Woodhouse Team</strong>
            </p>
          </div>
          <div style="background-color: #c87a3e; padding: 15px; text-align: center;">
            <p style="color: white; margin: 0; font-size: 12px;">
              Woodhouse Agency | Allied Air Turnkey Social Media Program
            </p>
          </div>
        </div>
      `,
    },
  };

  const template = templates[emailType];
  if (!template) {
    console.error(`Unknown email type: ${emailType}`);
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Woodhouse Social Community Managers <communitymanagers@woodhouseagency.com>',
        to: [dealer.email],
        subject: template.subject,
        html: template.getBody(dealer),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to send email to ${dealer.email}:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Email send error for ${dealer.email}:`, error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: EmailRequest = await request.json();
    const { dealerNumbers, emailType } = body;

    if (!dealerNumbers || dealerNumbers.length === 0) {
      return NextResponse.json({ error: 'dealerNumbers array is required' }, { status: 400 });
    }

    if (!emailType) {
      return NextResponse.json({ error: 'emailType is required' }, { status: 400 });
    }

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Get spreadsheet data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!1:11',
    });

    const rows = response.data.values || [];
    if (rows.length < 6) {
      return NextResponse.json({ error: 'Spreadsheet missing expected rows' }, { status: 500 });
    }

    // Get dealer display names from database
    const db = new Database(DB_PATH, { readonly: true });
    const dealerInfo: Record<string, string> = {};
    const dealerQuery = db.prepare(`
      SELECT dealer_no, display_name FROM dealers WHERE dealer_no IN (${dealerNumbers.map(() => '?').join(',')})
    `);
    const dbDealers = dealerQuery.all(...dealerNumbers) as { dealer_no: string; display_name: string }[];
    for (const d of dbDealers) {
      dealerInfo[d.dealer_no] = d.display_name;
    }
    db.close();

    // Find columns for each dealer and send emails
    const numCols = rows[0]?.length || 0;
    const updates: { range: string; values: string[][] }[] = [];
    let sentCount = 0;
    const results: { dealerNo: string; success: boolean; message: string }[] = [];

    for (let col = COL_DEALERS_START; col < numCols; col++) {
      let dealerNo = rows[ROWS.DEALER_NO]?.[col]?.toString().trim();
      if (!dealerNo) continue;

      // Normalize dealer number
      try {
        if (dealerNo.includes('.') || dealerNo.toUpperCase().includes('E')) {
          dealerNo = String(parseInt(parseFloat(dealerNo).toString()));
        }
      } catch {
        // Keep original
      }

      if (!dealerNumbers.includes(dealerNo)) continue;

      const firstName = rows[ROWS.FIRST_NAME]?.[col]?.toString().trim() || '';
      const email = rows[ROWS.EMAIL]?.[col]?.toString().trim() || '';
      const displayName = dealerInfo[dealerNo] || '';

      // Send email
      const sent = await sendEmail({ dealerNo, firstName, email, displayName }, emailType);

      if (sent) {
        // Update status to "Email Sent"
        const colLetter = col < 26
          ? String.fromCharCode(65 + col)
          : String.fromCharCode(64 + Math.floor(col / 26)) + String.fromCharCode(65 + (col % 26));

        updates.push({
          range: `Sheet1!${colLetter}2`,
          values: [['Email Sent']],
        });

        sentCount++;
        results.push({ dealerNo, success: true, message: `Email sent to ${email}` });
      } else {
        results.push({ dealerNo, success: false, message: email ? 'Failed to send' : 'No email address' });
      }
    }

    // Batch update spreadsheet statuses
    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${sentCount} of ${dealerNumbers.length} emails`,
      sent: sentCount,
      total: dealerNumbers.length,
      results,
    });
  } catch (error) {
    console.error('Send batch emails error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send emails' },
      { status: 500 }
    );
  }
}
