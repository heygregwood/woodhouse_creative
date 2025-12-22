/**
 * POST /api/admin/populate-post-copy
 *
 * Populates personalized post copy for all dealers in the scheduling spreadsheet.
 * Reads base copy from column C for a given post row, replaces variables with
 * dealer-specific values, and writes to each dealer's column.
 *
 * Variables supported:
 *   {phone} or {number} - Dealer's phone number (from row 9)
 *   {website} - Dealer's website (from row 8)
 *   {name} - Dealer's display name (from row 11)
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const SPREADSHEET_ID = '1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY';

// Row indices (0-based)
const ROW_DEALER_NO = 0;      // Row 1: Dealer numbers
const ROW_PHONE = 8;          // Row 9: Phone
const ROW_WEBSITE = 7;        // Row 8: Website
const ROW_NAME = 10;          // Row 11: Display name
const ROW_POST_HEADER = 11;   // Row 12: Post header (Post #, Notes, Base Copy, etc.)

// Column indices (0-based)
const COL_POST_NUM = 0;       // Column A: Post number
const COL_BASE_COPY = 2;      // Column C: Base copy
const COL_DEALERS_START = 5;  // Column F: First dealer column

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

function getCellValue(rows: any[][], rowIdx: number, colIdx: number): string {
  if (rowIdx >= rows.length) return '';
  const row = rows[rowIdx];
  if (colIdx >= row.length) return '';
  return String(row[colIdx] || '').trim();
}

function colToLetter(colIdx: number): string {
  if (colIdx < 26) {
    return String.fromCharCode(65 + colIdx);
  }
  return String.fromCharCode(64 + Math.floor(colIdx / 26)) + String.fromCharCode(65 + (colIdx % 26));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postNumber, dryRun = false } = body;

    if (!postNumber) {
      return NextResponse.json({ error: 'Post number is required' }, { status: 400 });
    }

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Read all data from sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A1:ZZ200', // Wide range to capture all dealers
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Spreadsheet is empty' }, { status: 500 });
    }

    const maxCols = Math.max(...rows.map(r => r.length));

    // Find the post row
    let postRowIdx: number | null = null;
    for (let i = ROW_POST_HEADER + 1; i < rows.length; i++) {
      const row = rows[i];
      if (row && row.length > COL_POST_NUM) {
        try {
          if (parseInt(row[COL_POST_NUM]) === postNumber) {
            postRowIdx = i;
            break;
          }
        } catch {
          continue;
        }
      }
    }

    if (postRowIdx === null) {
      return NextResponse.json({ error: `Post ${postNumber} not found in spreadsheet` }, { status: 404 });
    }

    // Get base copy
    const baseCopy = getCellValue(rows, postRowIdx, COL_BASE_COPY);
    if (!baseCopy) {
      return NextResponse.json({ error: `No base copy found in column C for post ${postNumber}` }, { status: 400 });
    }

    // Get dealer columns
    const dealerRow = rows[ROW_DEALER_NO] || [];
    const numDealers = dealerRow.length - COL_DEALERS_START;

    // Build updates
    const updates: { range: string; values: string[][] }[] = [];
    const preview: { dealerNo: string; name: string; copy: string }[] = [];

    for (let colIdx = COL_DEALERS_START; colIdx < dealerRow.length; colIdx++) {
      const dealerNo = getCellValue(rows, ROW_DEALER_NO, colIdx);
      const phone = getCellValue(rows, ROW_PHONE, colIdx);
      const website = getCellValue(rows, ROW_WEBSITE, colIdx);
      const name = getCellValue(rows, ROW_NAME, colIdx);

      if (!dealerNo || dealerNo === 'Dealer Number') {
        continue;
      }

      // Replace variables
      let personalized = baseCopy;
      personalized = personalized.replace(/{phone}/g, phone);
      personalized = personalized.replace(/{number}/g, phone); // Alias for {phone}
      personalized = personalized.replace(/{website}/g, website);
      personalized = personalized.replace(/{name}/g, name);

      const colLetter = colToLetter(colIdx);
      const cellRef = `Sheet1!${colLetter}${postRowIdx + 1}`;

      updates.push({
        range: cellRef,
        values: [[personalized]],
      });

      preview.push({
        dealerNo,
        name,
        copy: personalized.length > 100 ? personalized.substring(0, 100) + '...' : personalized,
      });
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        postNumber,
        baseCopy,
        totalDealers: updates.length,
        preview: preview.slice(0, 5),
        message: `Would update ${updates.length} dealer cells for post ${postNumber}`,
      });
    }

    // Write updates to sheet
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates,
      },
    });

    return NextResponse.json({
      success: true,
      postNumber,
      baseCopy,
      totalUpdated: updates.length,
      message: `Updated ${updates.length} dealer cells for post ${postNumber}`,
    });
  } catch (error) {
    console.error('Populate post copy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to populate post copy' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/populate-post-copy?postNumber=666
 *
 * Preview what would be populated (dry run)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const postNumberStr = searchParams.get('postNumber');

  if (!postNumberStr) {
    return NextResponse.json({ error: 'postNumber query param is required' }, { status: 400 });
  }

  const postNumber = parseInt(postNumberStr);
  if (isNaN(postNumber)) {
    return NextResponse.json({ error: 'postNumber must be a number' }, { status: 400 });
  }

  // Create a mock request for the POST handler with dryRun=true
  const mockRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ postNumber, dryRun: true }),
  });

  return POST(mockRequest);
}
