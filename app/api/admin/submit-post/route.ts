/**
 * POST /api/admin/submit-post
 *
 * Submits a new post to the scheduling spreadsheet.
 * - Adds post number and base copy to the next available row
 * - Populates personalized copy for each dealer column
 * - Optionally saves to Posts Excel
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import Database from 'better-sqlite3';
import path from 'path';

const SPREADSHEET_ID = '1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY';
const POSTS_FILE_ID = '1-lhgjbNL1QBFNLZ5eSQSdaJTwIX0JKfE';
const DB_PATH = path.join(process.cwd(), 'data', 'sqlite', 'creative.db');

const COL_DEALERS_START = 6; // Column G (0-indexed)

// Row definitions
const ROWS = {
  DEALER_NO: 0,
  DISPLAY_NAME: 10,
  PHONE: 8,
  WEBSITE: 7,
};

interface PostData {
  postNumber: string;
  templateId: string;
  baseCopy: string;
  season: string;
  subjectMatter: string;
  tag1: string;
  tag2: string;
  tag3: string;
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

function personalizePostCopy(baseCopy: string, dealer: {
  displayName: string;
  phone: string;
  website: string;
}): string {
  return baseCopy
    .replace(/{name}/gi, dealer.displayName || '')
    .replace(/{phone}/gi, dealer.phone || '')
    .replace(/{website}/gi, dealer.website || '');
}

export async function POST(request: NextRequest) {
  try {
    const body: PostData = await request.json();
    const { postNumber, templateId, baseCopy, season, subjectMatter, tag1, tag2, tag3 } = body;

    if (!postNumber || !templateId || !baseCopy) {
      return NextResponse.json(
        { error: 'postNumber, templateId, and baseCopy are required' },
        { status: 400 }
      );
    }

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Get current spreadsheet data to find dealer columns
    const metadataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!1:11',
    });

    const rows = metadataResponse.data.values || [];
    if (rows.length < 11) {
      return NextResponse.json({ error: 'Spreadsheet missing dealer metadata rows' }, { status: 500 });
    }

    // Find the next available row for the post
    const sheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      ranges: ['Sheet1!A:A'],
      includeGridData: true,
    });

    const gridData = sheetInfo.data.sheets?.[0]?.data?.[0];
    const lastRow = gridData?.rowData?.length || 12;
    const nextRow = lastRow + 1;

    // Build updates for the new post row
    const numCols = rows[0]?.length || 0;
    const updates: { range: string; values: string[][] }[] = [];

    // Column A: Post number
    updates.push({
      range: `Sheet1!A${nextRow}`,
      values: [[postNumber]],
    });

    // Column B: Template ID
    updates.push({
      range: `Sheet1!B${nextRow}`,
      values: [[templateId]],
    });

    // Column C: Season
    updates.push({
      range: `Sheet1!C${nextRow}`,
      values: [[season || '']],
    });

    // Column D: Subject Matter
    updates.push({
      range: `Sheet1!D${nextRow}`,
      values: [[subjectMatter || '']],
    });

    // Column E: Base Copy
    updates.push({
      range: `Sheet1!E${nextRow}`,
      values: [[baseCopy]],
    });

    // Column F: Tags (combined)
    const tags = [tag1, tag2, tag3].filter(Boolean).join(', ');
    updates.push({
      range: `Sheet1!F${nextRow}`,
      values: [[tags]],
    });

    // Populate personalized copy for each dealer column
    for (let col = COL_DEALERS_START; col < numCols; col++) {
      const dealerNo = rows[ROWS.DEALER_NO]?.[col]?.toString().trim();
      if (!dealerNo) continue;

      const displayName = rows[ROWS.DISPLAY_NAME]?.[col]?.toString().trim() || '';
      const phone = rows[ROWS.PHONE]?.[col]?.toString().trim() || '';
      const website = rows[ROWS.WEBSITE]?.[col]?.toString().trim() || '';

      const personalizedCopy = personalizePostCopy(baseCopy, { displayName, phone, website });

      const colLetter = col < 26
        ? String.fromCharCode(65 + col)
        : String.fromCharCode(64 + Math.floor(col / 26)) + String.fromCharCode(65 + (col % 26));

      updates.push({
        range: `Sheet1!${colLetter}${nextRow}`,
        values: [[personalizedCopy]],
      });
    }

    // Batch update the spreadsheet
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates,
      },
    });

    // Store post info in database for tracking
    try {
      const db = new Database(DB_PATH);
      db.prepare(`
        CREATE TABLE IF NOT EXISTS posts (
          post_number TEXT PRIMARY KEY,
          template_id TEXT NOT NULL,
          base_copy TEXT NOT NULL,
          season TEXT,
          subject_matter TEXT,
          tags TEXT,
          spreadsheet_row INTEGER,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `).run();

      db.prepare(`
        INSERT OR REPLACE INTO posts (post_number, template_id, base_copy, season, subject_matter, tags, spreadsheet_row, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(postNumber, templateId, baseCopy, season, subjectMatter, tags, nextRow);

      db.close();
    } catch (dbError) {
      console.error('Database save error (non-critical):', dbError);
    }

    return NextResponse.json({
      success: true,
      message: `Post ${postNumber} added to row ${nextRow} with ${numCols - COL_DEALERS_START} personalized copies`,
      row: nextRow,
      dealersUpdated: numCols - COL_DEALERS_START,
    });
  } catch (error) {
    console.error('Submit post error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit post' },
      { status: 500 }
    );
  }
}
