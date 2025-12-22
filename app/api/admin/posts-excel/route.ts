/**
 * GET /api/admin/posts-excel?postNumber=667
 *
 * Fetches post data from the Posts Excel file on Google Drive.
 * Returns post copy, season, subject matter, and tags.
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Posts Excel (No Images) on Google Drive
const POSTS_FILE_ID = '1-lhgjbNL1QBFNLZ5eSQSdaJTwIX0JKfE';

// Column indices (0-indexed)
const COLS = {
  POST_NUMBER: 0,    // A
  SEASON: 1,         // B
  POST_COPY: 2,      // C
  IMAGE: 3,          // D
  SUBJECT_MATTER: 4, // E
  TAG_1: 5,          // F
  TAG_2: 6,          // G
  TAG_3: 7,          // H
  NOTES: 8,          // I
  COMMENTS: 9,       // J
  AAE_APPROVED: 10,  // K
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
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/spreadsheets.readonly',
    ],
  });
}

export async function GET(request: NextRequest) {
  const postNumber = request.nextUrl.searchParams.get('postNumber');

  if (!postNumber) {
    return NextResponse.json({ error: 'postNumber is required' }, { status: 400 });
  }

  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Read from the Posts Excel file (exported as Google Sheet format)
    // Since it's an Excel file, we need to use Drive API to export it
    // But for .xlsx files accessed via Sheets API, it should work if shared

    // First try reading directly as a spreadsheet (works for xlsx on Drive)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: POSTS_FILE_ID,
      range: 'A:K', // All columns A through K
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Posts Excel file is empty' }, { status: 500 });
    }

    // Find the row with the matching post number (skip header row)
    let postRow: string[] | null = null;
    for (let i = 1; i < rows.length; i++) {
      const rowPostNum = rows[i][COLS.POST_NUMBER]?.toString().trim();
      if (rowPostNum === postNumber) {
        postRow = rows[i];
        break;
      }
    }

    if (!postRow) {
      return NextResponse.json({ error: `Post ${postNumber} not found` }, { status: 404 });
    }

    return NextResponse.json({
      post: {
        postNumber: postRow[COLS.POST_NUMBER]?.toString().trim() || '',
        season: postRow[COLS.SEASON]?.toString().trim() || '',
        postCopy: postRow[COLS.POST_COPY]?.toString().trim() || '',
        image: postRow[COLS.IMAGE]?.toString().trim() || '',
        subjectMatter: postRow[COLS.SUBJECT_MATTER]?.toString().trim() || '',
        tag1: postRow[COLS.TAG_1]?.toString().trim() || '',
        tag2: postRow[COLS.TAG_2]?.toString().trim() || '',
        tag3: postRow[COLS.TAG_3]?.toString().trim() || '',
        notes: postRow[COLS.NOTES]?.toString().trim() || '',
        comments: postRow[COLS.COMMENTS]?.toString().trim() || '',
        aaeApproved: postRow[COLS.AAE_APPROVED]?.toString().trim() || '',
      },
    });
  } catch (error) {
    console.error('Posts Excel read error:', error);

    // If Sheets API fails (file is xlsx, not native Sheet), return a helpful error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return NextResponse.json(
        { error: 'Posts Excel file not found. Ensure the file is shared with the service account.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: `Failed to read Posts Excel: ${errorMessage}` },
      { status: 500 }
    );
  }
}
