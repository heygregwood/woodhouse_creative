/**
 * Google Sheets Module - Replaces Python add_dealer_to_spreadsheet.py
 *
 * Handles adding dealers to scheduling spreadsheet and populating post copy
 */

import { google } from 'googleapis';
import Database from 'better-sqlite3';
import path from 'path';

const SPREADSHEET_ID = '1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY';
const DB_PATH = path.join(process.cwd(), 'data', 'sqlite', 'creative.db');

// Row indices (1-based)
const ROW_DEALER_NO = 1;      // Row 1: Dealer numbers
const ROW_EMAIL_STATUS = 2;   // Row 2: Schedule Email Status
const ROW_LAST_POST = 3;      // Row 3: Last Post Date
const ROW_WHO_POSTED = 4;     // Row 4: Who Posted
const ROW_FIRST_NAME = 5;     // Row 5: First Name
const ROW_EMAIL = 6;          // Row 6: Email
const ROW_REGION = 7;         // Row 7: Region
const ROW_WEBSITE = 8;        // Row 8: Website
const ROW_PHONE = 9;          // Row 9: Phone
const ROW_DISTRIBUTOR = 10;   // Row 10: Distributor/Dealer Name
const ROW_DISPLAY_NAME = 11;  // Row 11: Display name
const ROW_POST_HEADER = 12;   // Row 12: Post header row
const ROW_POSTS_START = 13;   // Row 13+: Post rows with base copy in column C

// Column indices (0-based)
const COL_DEALERS_START = 6;  // Column G - where dealer columns start
const COL_BASE_COPY = 2;      // Column C - base post copy with {number} placeholder

export interface DealerSpreadsheetData {
  dealer_no: string;
  display_name: string;
  phone: string;
  website: string;
  dealer_name: string;
  distributor_name: string;
  first_name: string;
  email: string;
  region: string;
  program_status: string;
}

export interface AddDealerResult {
  success: boolean;
  dealer_no: string;
  message: string;
  column: string | null;
}

/**
 * Get authenticated Google Sheets service
 */
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

/**
 * Get dealer data from database
 */
function getDealerFromDb(dealerNo: string): DealerSpreadsheetData | null {
  const db = new Database(DB_PATH, { readonly: true });

  const dealer = db.prepare(`
    SELECT
      dealer_no,
      display_name,
      creatomate_phone,
      creatomate_website,
      dealer_name,
      distributor_name,
      contact_first_name,
      contact_name,
      contact_email,
      region,
      program_status
    FROM dealers
    WHERE dealer_no = ?
  `).get(dealerNo) as any;

  db.close();

  if (!dealer) {
    return null;
  }

  // For first_name: use contact_first_name if available, otherwise extract from contact_name
  let firstName = dealer.contact_first_name || '';
  if (!firstName && dealer.contact_name) {
    // Extract first name from full contact name (e.g., "Greg Wood" -> "Greg")
    firstName = dealer.contact_name.split(' ')[0] || '';
  }

  return {
    dealer_no: dealer.dealer_no,
    display_name: dealer.display_name || '',
    phone: dealer.creatomate_phone || '',
    website: dealer.creatomate_website || '',
    dealer_name: dealer.dealer_name || '',
    distributor_name: dealer.distributor_name || '',
    first_name: firstName,
    email: dealer.contact_email || '',
    region: dealer.region || '',
    program_status: dealer.program_status,
  };
}

/**
 * Convert 0-based column index to letter(s)
 */
function colToLetter(colIdx: number): string {
  if (colIdx < 26) {
    return String.fromCharCode(65 + colIdx);
  } else {
    return String.fromCharCode(64 + Math.floor(colIdx / 26)) + String.fromCharCode(65 + (colIdx % 26));
  }
}

/**
 * Find column index for a dealer, or -1 if not found
 */
function findDealerColumn(rows: string[][], dealerNo: string): number {
  if (!rows || rows.length === 0) {
    return -1;
  }

  const dealerRow = rows[0]; // Row 1 has dealer numbers

  for (let colIdx = COL_DEALERS_START; colIdx < dealerRow.length; colIdx++) {
    let cellValue = String(dealerRow[colIdx] || '').trim();

    // Handle float formatting
    try {
      if (cellValue.includes('.') || cellValue.toUpperCase().includes('E')) {
        cellValue = String(parseInt(parseFloat(cellValue)));
      }
    } catch {
      // Keep original
    }

    if (cellValue === dealerNo) {
      return colIdx;
    }
  }

  return -1;
}

/**
 * Find the next empty column after all existing dealers
 */
function findNextEmptyColumn(rows: string[][]): number {
  if (!rows || rows.length === 0) {
    return COL_DEALERS_START;
  }

  const dealerRow = rows[0]; // Row 1 has dealer numbers

  // Find the last non-empty column
  let lastCol = COL_DEALERS_START - 1;
  for (let colIdx = COL_DEALERS_START; colIdx < dealerRow.length; colIdx++) {
    const cellValue = String(dealerRow[colIdx] || '').trim();
    if (cellValue && cellValue !== 'Dealer Number') {
      lastCol = colIdx;
    }
  }

  return lastCol + 1;
}

/**
 * Add a dealer to the scheduling spreadsheet
 */
export async function addDealerToSpreadsheet(
  dealerNo: string,
  dryRun: boolean = false
): Promise<AddDealerResult> {
  const result: AddDealerResult = {
    success: false,
    dealer_no: dealerNo,
    message: '',
    column: null,
  };

  // Get dealer from database
  const dealer = getDealerFromDb(dealerNo);
  if (!dealer) {
    result.message = `Dealer ${dealerNo} not found in database`;
    return result;
  }

  if (dealer.program_status !== 'FULL') {
    result.message = `Dealer ${dealerNo} is not FULL status (status: ${dealer.program_status})`;
    return result;
  }

  console.log(`[google-sheets] Adding dealer ${dealerNo} (${dealer.display_name}) to spreadsheet...`);

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // Get spreadsheet data
  // Read a wide range to ensure we capture all existing dealer columns
  // Column KU = 307 columns which gives room for 300+ dealers
  // Read up to row 1000 to capture all post rows (row 13+ have base post copy)
  const sheetResult = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Sheet1!A1:KU1000'
  });

  const rows = (sheetResult.data.values || []) as string[][];

  // Check if dealer already exists
  const existingCol = findDealerColumn(rows, dealerNo);
  if (existingCol >= 0) {
    const colLetter = colToLetter(existingCol);
    result.message = `Dealer ${dealerNo} already exists in column ${colLetter}`;
    result.column = colLetter;
    result.success = true;
    console.log(`[google-sheets] Dealer already exists in column ${colLetter}`);
    return result;
  }

  // Find next empty column
  const newCol = findNextEmptyColumn(rows);
  const colLetter = colToLetter(newCol);

  console.log(`[google-sheets] Will add to column ${colLetter} (index ${newCol})`);

  // Prepare updates - Row mapping:
  // Row 1: Dealer Number
  // Row 2: Schedule Email Status (Pending)
  // Row 3: Last Post Date (empty)
  // Row 4: Who Posted (empty)
  // Row 5: First Name
  // Row 6: Email
  // Row 7: Region
  // Row 8: Website
  // Row 9: Phone
  // Row 10: Distributor Name
  // Row 11: Dealer Name
  const updates = [
    { range: `Sheet1!${colLetter}1`, values: [[dealer.dealer_no]] },
    { range: `Sheet1!${colLetter}2`, values: [['Pending']] },
    { range: `Sheet1!${colLetter}3`, values: [['']] },
    { range: `Sheet1!${colLetter}4`, values: [['']] },
    { range: `Sheet1!${colLetter}5`, values: [[dealer.first_name]] },
    { range: `Sheet1!${colLetter}6`, values: [[dealer.email]] },
    { range: `Sheet1!${colLetter}7`, values: [[dealer.region]] },
    { range: `Sheet1!${colLetter}8`, values: [[dealer.website]] },
    { range: `Sheet1!${colLetter}9`, values: [[dealer.phone]] },
    { range: `Sheet1!${colLetter}10`, values: [[dealer.distributor_name]] },
    { range: `Sheet1!${colLetter}11`, values: [[dealer.dealer_name]] },
  ];

  // Populate personalized post copy for all post rows
  // Row 13+ have base copy in column C with {number} placeholder
  let postCopyCount = 0;
  for (let rowIdx = ROW_POSTS_START - 1; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    // Check if this row has base copy in column C
    if (row && row.length > COL_BASE_COPY) {
      const baseCopy = row[COL_BASE_COPY];
      if (baseCopy && baseCopy.includes('{number}')) {
        // Replace {number} with dealer's phone
        const personalizedCopy = baseCopy.replace(/{number}/g, dealer.phone);
        const rowNum = rowIdx + 1; // Convert to 1-based row number
        updates.push({
          range: `Sheet1!${colLetter}${rowNum}`,
          values: [[personalizedCopy]]
        });
        postCopyCount++;
      }
    }
  }

  console.log(`[google-sheets] Will populate ${postCopyCount} post copy rows`);

  if (dryRun) {
    console.log(`[google-sheets] [DRY RUN] Would write to column ${colLetter}:`);
    updates.slice(0, 11).forEach(u => {
      console.log(`  ${u.range}: ${u.values[0][0]}`);
    });
    if (postCopyCount > 0) {
      console.log(`  ... plus ${postCopyCount} post copy rows (row 13+)`);
    }
    result.success = true;
    result.column = colLetter;
    result.message = `[DRY RUN] Would add to column ${colLetter}`;
    return result;
  }

  // Write to spreadsheet
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: updates
    }
  });

  result.success = true;
  result.column = colLetter;
  result.message = `Added dealer to column ${colLetter}`;
  console.log(`[google-sheets] Added dealer to column ${colLetter}`);

  return result;
}
