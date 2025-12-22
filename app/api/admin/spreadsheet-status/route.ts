/**
 * GET /api/admin/spreadsheet-status
 *
 * Fetches current dealer status from the scheduling spreadsheet.
 * Returns dealer status (Pending, Done, Email Sent) and metadata.
 */

import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const SPREADSHEET_ID = '1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY';
const COL_DEALERS_START = 6; // Column G (0-indexed = 6)

// Row definitions (1-indexed in spreadsheet, 0-indexed in array)
const ROWS = {
  DEALER_NO: 0,      // Row 1
  STATUS: 1,         // Row 2 - Pending, Done, Email Sent
  LAST_POST_DATE: 2, // Row 3
  WHO_POSTED: 3,     // Row 4
  FIRST_NAME: 4,     // Row 5
  EMAIL: 5,          // Row 6
  REGION: 6,         // Row 7
  WEBSITE: 7,        // Row 8
  PHONE: 8,          // Row 9
  DISTRIBUTOR: 9,    // Row 10
  DISPLAY_NAME: 10,  // Row 11
};

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
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

export async function GET() {
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch rows 1-11 (dealer metadata)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!1:11',
    });

    const rows = response.data.values || [];
    if (rows.length < 11) {
      return NextResponse.json({ error: 'Spreadsheet missing expected rows' }, { status: 500 });
    }

    // Parse dealer columns (starting from column G)
    const dealers = [];
    const numCols = rows[0]?.length || 0;

    for (let col = COL_DEALERS_START; col < numCols; col++) {
      const dealerNo = rows[ROWS.DEALER_NO]?.[col]?.toString().trim();
      if (!dealerNo || dealerNo === '') continue;

      // Normalize dealer number (handle scientific notation from Excel)
      let normalizedDealerNo = dealerNo;
      try {
        if (dealerNo.includes('.') || dealerNo.toUpperCase().includes('E')) {
          normalizedDealerNo = String(parseInt(parseFloat(dealerNo).toString()));
        }
      } catch {
        // Keep original if parsing fails
      }

      const status = rows[ROWS.STATUS]?.[col]?.toString().trim() || 'Pending';

      dealers.push({
        dealerNo: normalizedDealerNo,
        displayName: rows[ROWS.DISPLAY_NAME]?.[col]?.toString().trim() || '',
        status: status as 'Pending' | 'Done' | 'Email Sent',
        lastPostDate: rows[ROWS.LAST_POST_DATE]?.[col]?.toString().trim() || '',
        whoPosted: rows[ROWS.WHO_POSTED]?.[col]?.toString().trim() || '',
        email: rows[ROWS.EMAIL]?.[col]?.toString().trim() || '',
        region: rows[ROWS.REGION]?.[col]?.toString().trim() || '',
      });
    }

    // Sort by display name
    dealers.sort((a, b) => a.displayName.localeCompare(b.displayName));

    return NextResponse.json({
      dealers,
      totalDealers: dealers.length,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Spreadsheet status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch spreadsheet status' },
      { status: 500 }
    );
  }
}
