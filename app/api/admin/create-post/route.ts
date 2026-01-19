/**
 * POST /api/admin/create-post
 *
 * Complete workflow for creating a new post:
 * 1. Add template ID to Firestore posts collection
 * 2. Add post number and base copy to scheduling spreadsheet
 * 3. Populate personalized copy for all dealer columns
 * 4. Create render jobs for all FULL dealers
 *
 * Request body:
 * {
 *   postNumber: number,
 *   templateId: string,
 *   baseCopy: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { db } from '@/lib/firebase';
import { getDealers } from '@/lib/firestore-dealers';
import { createRenderBatch, createRenderJob } from '@/lib/renderQueue';

const SPREADSHEET_ID = '1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY';

// Spreadsheet structure
const COL_POST_NUMBER = 0;  // Column A
const COL_BASE_COPY = 2;    // Column C
const COL_DEALERS_START = 6; // Column G - where dealer columns start
const ROW_POSTS_START = 13;  // Row 13+ for posts

// Metadata rows (0-indexed)
const ROW_DEALER_NO = 0;     // Row 1
const ROW_DISPLAY_NAME = 10; // Row 11
const ROW_PHONE = 8;         // Row 9
const ROW_WEBSITE = 7;       // Row 8

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

function indexToColumn(index: number): string {
  let result = '';
  while (index >= 0) {
    result = String.fromCharCode((index % 26) + 65) + result;
    index = Math.floor(index / 26) - 1;
  }
  return result;
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
    const body = await request.json();
    const { postNumber, templateId, baseCopy } = body;

    // Validate inputs
    if (!postNumber || !templateId || !baseCopy) {
      return NextResponse.json(
        { error: 'postNumber, templateId, and baseCopy are required' },
        { status: 400 }
      );
    }

    const postNum = parseInt(postNumber.toString());
    if (isNaN(postNum)) {
      return NextResponse.json(
        { error: 'postNumber must be a valid number' },
        { status: 400 }
      );
    }

    console.log(`[create-post] Starting workflow for post ${postNum}`);

    // Step 1: Add template ID to Firestore posts collection
    console.log(`[create-post] Step 1: Adding to Firestore posts collection`);
    await db.collection('posts').doc(postNum.toString()).set({
      templateId: templateId.trim(),
      baseCopy: baseCopy,
      createdAt: new Date().toISOString(),
    });

    // Step 2: Add to scheduling spreadsheet
    console.log(`[create-post] Step 2: Adding to scheduling spreadsheet`);
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Get current spreadsheet data
    const metadataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!1:11',
    });

    const metadataRows = metadataResponse.data.values || [];
    if (metadataRows.length < 11) {
      throw new Error('Spreadsheet missing dealer metadata rows');
    }

    // Find next available row for the post (check column A from row 13 onwards)
    const postsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A13:A100',
    });

    const existingPosts = postsResponse.data.values || [];
    let nextRow = ROW_POSTS_START;

    // Find first empty row or row after existing posts
    for (let i = 0; i < existingPosts.length; i++) {
      if (existingPosts[i]?.[0]) {
        nextRow = ROW_POSTS_START + i + 1;
      }
    }

    // Check if post number already exists
    const existingPostNumbers = existingPosts.map(r => r?.[0]?.toString()).filter(Boolean);
    if (existingPostNumbers.includes(postNum.toString())) {
      return NextResponse.json(
        { error: `Post ${postNum} already exists in spreadsheet` },
        { status: 400 }
      );
    }

    const numCols = metadataRows[0]?.length || 0;
    const updates: { range: string; values: string[][] }[] = [];

    // Column A: Post number
    updates.push({
      range: `Sheet1!A${nextRow}`,
      values: [[postNum.toString()]],
    });

    // Column C: Base copy
    updates.push({
      range: `Sheet1!C${nextRow}`,
      values: [[baseCopy]],
    });

    // Step 3: Populate personalized copy for each dealer column
    console.log(`[create-post] Step 3: Populating personalized copy for dealers`);
    let dealersPopulated = 0;

    for (let col = COL_DEALERS_START; col < numCols; col++) {
      const dealerNo = metadataRows[ROW_DEALER_NO]?.[col]?.toString().trim();
      if (!dealerNo) continue;

      const displayName = metadataRows[ROW_DISPLAY_NAME]?.[col]?.toString().trim() || '';
      const phone = metadataRows[ROW_PHONE]?.[col]?.toString().trim() || '';
      const website = metadataRows[ROW_WEBSITE]?.[col]?.toString().trim() || '';

      const personalizedCopy = personalizePostCopy(baseCopy, { displayName, phone, website });
      const colLetter = indexToColumn(col);

      updates.push({
        range: `Sheet1!${colLetter}${nextRow}`,
        values: [[personalizedCopy]],
      });

      dealersPopulated++;
    }

    // Batch update the spreadsheet
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates,
      },
    });

    console.log(`[create-post] Spreadsheet updated: row ${nextRow}, ${dealersPopulated} dealers`);

    // Step 4: Create render jobs for all FULL dealers
    console.log(`[create-post] Step 4: Creating render jobs`);

    // Get all FULL dealers with complete creatomate data
    const allDealers = await getDealers();
    const fullDealers = allDealers.filter(d =>
      d.program_status === 'FULL' &&
      d.ready_for_automate === 'yes' &&
      d.creatomate_logo &&
      d.display_name
    );

    console.log(`[create-post] Found ${fullDealers.length} FULL dealers for rendering`);

    // Create batch
    const batchId = await createRenderBatch({
      postNumber: postNum,
      templateId: templateId.trim(),
      totalJobs: fullDealers.length,
      createdBy: 'create-post-api',
    });

    // Create render jobs for each dealer
    for (const dealer of fullDealers) {
      await createRenderJob({
        batchId,
        businessId: dealer.dealer_no,
        businessName: dealer.display_name || '',
        postNumber: postNum,
        templateId: templateId.trim(),
      });
    }

    console.log(`[create-post] Created batch ${batchId} with ${fullDealers.length} jobs`);

    // Calculate estimated completion
    const avgRenderTime = 2; // minutes per job / 25 jobs per minute
    const estimatedMinutes = Math.ceil(fullDealers.length / 25) * avgRenderTime + 5;

    return NextResponse.json({
      success: true,
      postNumber: postNum,
      templateId: templateId.trim(),
      spreadsheet: {
        row: nextRow,
        dealersPopulated,
      },
      render: {
        batchId,
        jobsCreated: fullDealers.length,
        estimatedMinutes,
      },
      message: `Post ${postNum} created successfully. ${fullDealers.length} render jobs queued.`,
    });

  } catch (error) {
    console.error('[create-post] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create post' },
      { status: 500 }
    );
  }
}
