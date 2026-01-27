/**
 * POST /api/admin/dealer-status
 *
 * Update dealer program status based on Facebook admin access changes.
 * Called by Google Apps Script when FB admin invite/removal emails arrive.
 *
 * Body:
 *   action: 'promote' | 'demote'
 *   dealer_name: string (from email subject)
 *   source: 'gmail_webhook' | 'manual' (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getDealers, promoteToFull, demoteToContent, type FirestoreDealer } from '@/lib/firestore-dealers';
import { getFolderIdByPath } from '@/lib/google-drive';
const SPREADSHEET_ID = '1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY';
const DEALERS_FOLDER_ID = '1QwyyE9Pq-p8u-TEz7B5nC-14BERpDPmv';
const COL_DEALERS_START = 6;

// Verify webhook secret (optional but recommended)
const WEBHOOK_SECRET = process.env.DEALER_STATUS_WEBHOOK_SECRET;

interface Dealer {
  dealer_no: string;
  display_name: string;
  dealer_name: string;
  program_status: string;
  contact_first_name: string;
  contact_email: string;
  region: string;
  creatomate_phone: string;
  creatomate_website: string;
}

function getGoogleAuth() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Missing Google credentials');
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: serviceAccountEmail,
      private_key: privateKey,
    },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
}

async function findDealerByName(name: string): Promise<Dealer | null> {
  // Get all dealers from Firestore
  const allDealers = await getDealers();

  // Try exact match first (case-insensitive)
  const nameLower = name.toLowerCase();
  let dealer = allDealers.find(d =>
    d.display_name?.toLowerCase() === nameLower ||
    d.dealer_name.toLowerCase() === nameLower
  );

  if (!dealer) {
    // Try partial match
    dealer = allDealers.find(d =>
      d.display_name?.toLowerCase().includes(nameLower) ||
      d.dealer_name.toLowerCase().includes(nameLower)
    );
  }

  if (!dealer) return null;

  return {
    dealer_no: dealer.dealer_no,
    display_name: dealer.display_name || dealer.dealer_name,
    dealer_name: dealer.dealer_name,
    program_status: dealer.program_status,
    contact_first_name: dealer.contact_first_name || '',
    contact_email: dealer.contact_email || '',
    region: dealer.region || '',
    creatomate_phone: dealer.creatomate_phone || '',
    creatomate_website: dealer.creatomate_website || '',
  };
}

async function addToSpreadsheet(dealer: Dealer, auth: ReturnType<typeof getGoogleAuth>) {
  const sheets = google.sheets({ version: 'v4', auth });

  // Read current row 1 to find next column
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Sheet1!1:11',
  });

  const rows = result.data.values || [];
  if (!rows.length) throw new Error('Spreadsheet is empty');

  const nextCol = rows[0].length;
  const colLetter = nextCol < 26
    ? String.fromCharCode(65 + nextCol)
    : String.fromCharCode(64 + Math.floor(nextCol / 26)) + String.fromCharCode(65 + (nextCol % 26));

  // Prepare data for new column (rows 1-11)
  const updates = [
    { range: `Sheet1!${colLetter}1`, values: [[dealer.dealer_no]] },
    { range: `Sheet1!${colLetter}2`, values: [['Pending']] },
    { range: `Sheet1!${colLetter}3`, values: [['']] },
    { range: `Sheet1!${colLetter}4`, values: [['']] },
    { range: `Sheet1!${colLetter}5`, values: [[dealer.contact_first_name || '']] },
    { range: `Sheet1!${colLetter}6`, values: [[dealer.contact_email || '']] },
    { range: `Sheet1!${colLetter}7`, values: [[dealer.region || '']] },
    { range: `Sheet1!${colLetter}8`, values: [[dealer.creatomate_website || '']] },
    { range: `Sheet1!${colLetter}9`, values: [[dealer.creatomate_phone || '']] },
    { range: `Sheet1!${colLetter}10`, values: [[dealer.dealer_name || '']] },
    { range: `Sheet1!${colLetter}11`, values: [[dealer.display_name || '']] },
  ];

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: updates,
    },
  });

  return colLetter;
}

async function removeFromSpreadsheet(dealerNo: string, auth: ReturnType<typeof getGoogleAuth>) {
  const sheets = google.sheets({ version: 'v4', auth });

  // Read row 1 to find dealer column
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Sheet1!1:1',
  });

  const row1 = result.data.values?.[0] || [];
  let colIdx: number | null = null;

  for (let i = COL_DEALERS_START; i < row1.length; i++) {
    let cellValue = String(row1[i]).trim();
    try {
      if (cellValue.includes('.') || cellValue.toUpperCase().includes('E')) {
        cellValue = String(parseInt(parseFloat(cellValue).toString()));
      }
    } catch {
      // ignore
    }

    if (cellValue === dealerNo) {
      colIdx = i;
      break;
    }
  }

  if (colIdx === null) {
    return false;
  }

  // Delete the column
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: 0,
            dimension: 'COLUMNS',
            startIndex: colIdx,
            endIndex: colIdx + 1,
          },
        },
      }],
    },
  });

  return true;
}

async function createDriveFolder(dealerName: string, _auth: ReturnType<typeof getGoogleAuth>) {
  // Use shared folder creation from lib/google-drive.ts which has
  // race condition protection (in-process lock + post-creation verification)
  const sanitizedName = dealerName.replace(/[/\\?%*:|"<>]/g, '-');
  return getFolderIdByPath(`Dealers/${sanitizedName}`);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, dealer_name, source, secret } = body;

    // Verify secret if configured
    if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!action || !dealer_name) {
      return NextResponse.json(
        { error: 'Missing required fields: action, dealer_name' },
        { status: 400 }
      );
    }

    if (!['promote', 'demote'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "promote" or "demote"' },
        { status: 400 }
      );
    }

    const dealer = await findDealerByName(dealer_name);

    if (!dealer) {
      return NextResponse.json(
        { error: `Dealer not found: ${dealer_name}` },
        { status: 404 }
      );
    }

    const auth = getGoogleAuth();
    const results: string[] = [];

    if (action === 'promote') {
      if (dealer.program_status === 'FULL') {
        return NextResponse.json({
          success: true,
          message: 'Dealer is already FULL status',
          dealer_no: dealer.dealer_no,
          display_name: dealer.display_name,
        });
      }

      // Update Firestore - promote to FULL with pending_review
      await promoteToFull(dealer.dealer_no, true);
      results.push('Firestore updated to FULL (pending_review)');

      // Create Drive folder
      const folderId = await createDriveFolder(dealer.display_name, auth);
      results.push(`Drive folder: ${folderId}`);

      // Add to spreadsheet
      const colLetter = await addToSpreadsheet(dealer, auth);
      results.push(`Added to spreadsheet column ${colLetter}`);

    } else {
      // demote
      if (dealer.program_status === 'CONTENT') {
        return NextResponse.json({
          success: true,
          message: 'Dealer is already CONTENT status',
          dealer_no: dealer.dealer_no,
          display_name: dealer.display_name,
        });
      }

      // Update Firestore
      await demoteToContent(dealer.dealer_no);
      results.push('Firestore updated to CONTENT');

      // Remove from spreadsheet
      const removed = await removeFromSpreadsheet(dealer.dealer_no, auth);
      results.push(removed ? 'Removed from spreadsheet' : 'Not found in spreadsheet');
    }

    // Log the change
    console.log(`[dealer-status] ${action}: ${dealer.display_name} (${dealer.dealer_no}) - source: ${source || 'unknown'}`);

    return NextResponse.json({
      success: true,
      action,
      dealer_no: dealer.dealer_no,
      display_name: dealer.display_name,
      results,
      next_steps: action === 'promote' ? [
        'Upload logo to dealer Drive folder',
        'Update creatomate_logo in database',
        'Send fb_admin_accepted email',
      ] : [],
    });

  } catch (error) {
    console.error('Dealer status update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
