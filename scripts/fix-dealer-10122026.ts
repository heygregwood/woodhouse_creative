/**
 * Fix script for dealer 10122026 (Ron's Heating and Cooling - BC, Canada)
 *
 * Problem: During onboarding, the Ohio "Ron's Heating and Cooling" (ronsheatingandcooling.com)
 * was confused with the BC Canada dealer. Wrong phone (740-922-5252) and wrong website
 * (ronsheatingandcooling.com) were set in creatomate fields.
 *
 * Confirmed correct data (from Facebook page):
 *   Phone: 604-798-5981 (matches Allied Excel)
 *   Website: NONE (Ron has no website)
 *
 * This script fixes:
 *   1. Firestore: creatomate_phone, creatomate_website
 *   2. Google Sheets scheduling spreadsheet: Row 8 (Website), Row 9 (Phone)
 *   3. Allied Air Excel via Graph API: Column M (TurnkeyURL), Column V (Dealer Web Address)
 *   4. Identifies last 6 posts for re-rendering
 *
 * Usage:
 *   cd ~/woodhouse_creative
 *   set -a && source .env.local && set +a
 *
 *   # Dry run (default) - shows what would change
 *   npx tsx scripts/fix-dealer-10122026.ts
 *
 *   # Apply all fixes
 *   npx tsx scripts/fix-dealer-10122026.ts --apply
 *
 *   # Apply fixes + trigger re-renders for last 6 posts
 *   npx tsx scripts/fix-dealer-10122026.ts --apply --render
 */

import { getDealer, updateDealer } from '../lib/firestore-dealers';
import { google } from 'googleapis';
import { getAuthenticatedGraphClient } from '../lib/microsoft-auth';

const DEALER_NO = '10122026';
const CORRECT_PHONE = '604-798-5981';
const CORRECT_WEBSITE = ''; // Ron has no website

// Google Sheets
const SPREADSHEET_ID = '1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY';
const COL_DEALERS_START = 6; // Column G

// Allied Air Excel
const DRIVE_OWNER_EMAIL = process.env.SHAREPOINT_OWNER_EMAIL || 'greg@woodhouseagency.com';
const FILE_PATH = process.env.SHAREPOINT_FILE_PATH || '/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database/Turnkey Social Media - Dealers - Current.xlsm';
const SHEET_NAME = 'Woodhouse Data';

// Parse args
const args = process.argv.slice(2);
const applyMode = args.includes('--apply');
const renderMode = args.includes('--render');

function getGoogleAuth() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Missing Google service account credentials');
  }
  return new google.auth.GoogleAuth({
    credentials: { client_email: serviceAccountEmail, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function colToLetter(colIdx: number): string {
  if (colIdx < 26) return String.fromCharCode(65 + colIdx);
  return String.fromCharCode(64 + Math.floor(colIdx / 26)) + String.fromCharCode(65 + (colIdx % 26));
}

async function fixFirestore(): Promise<boolean> {
  console.log('\n=== STEP 1: Firestore ===');

  const dealer = await getDealer(DEALER_NO);
  if (!dealer) {
    console.error(`Dealer ${DEALER_NO} not found in Firestore!`);
    return false;
  }

  console.log(`  Dealer: ${dealer.display_name} (${DEALER_NO})`);
  console.log(`  Current creatomate_phone: "${dealer.creatomate_phone}"`);
  console.log(`  Current creatomate_website: "${dealer.creatomate_website}"`);
  console.log(`  Correct phone: "${CORRECT_PHONE}"`);
  console.log(`  Correct website: "${CORRECT_WEBSITE}" (none)`);

  const phoneNeedsUpdate = dealer.creatomate_phone !== CORRECT_PHONE;
  const websiteNeedsUpdate = dealer.creatomate_website !== CORRECT_WEBSITE && dealer.creatomate_website !== null;

  if (!phoneNeedsUpdate && !websiteNeedsUpdate) {
    console.log('  -> Already correct, no changes needed.');
    return true;
  }

  if (applyMode) {
    await updateDealer(DEALER_NO, {
      creatomate_phone: CORRECT_PHONE,
      creatomate_website: CORRECT_WEBSITE || null,
    });
    console.log('  -> APPLIED: Updated creatomate_phone and creatomate_website');
  } else {
    console.log('  -> DRY RUN: Would update creatomate_phone and creatomate_website');
  }

  return true;
}

async function fixGoogleSheets(): Promise<{ dealerCol: string; last6Posts: Array<{ postNumber: number; rowNumber: number }> }> {
  console.log('\n=== STEP 2: Google Sheets Scheduling Spreadsheet ===');

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // Read the full spreadsheet
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Sheet1!A1:KU1000',
  });

  const rows = response.data.values || [];
  if (rows.length < 11) {
    throw new Error('Spreadsheet missing expected rows');
  }

  // Find dealer column
  const dealerRow = rows[0]; // Row 1 has dealer numbers
  let dealerColIdx = -1;

  for (let col = COL_DEALERS_START; col < (dealerRow?.length || 0); col++) {
    let cellValue = String(dealerRow[col] || '').trim();
    try {
      if (cellValue.includes('.') || cellValue.toUpperCase().includes('E')) {
        cellValue = String(Math.floor(parseFloat(cellValue)));
      }
    } catch { /* keep original */ }

    if (cellValue === DEALER_NO) {
      dealerColIdx = col;
      break;
    }
  }

  if (dealerColIdx < 0) {
    console.error(`  Dealer ${DEALER_NO} not found in scheduling spreadsheet!`);
    return { dealerCol: '', last6Posts: [] };
  }

  const colLetter = colToLetter(dealerColIdx);
  console.log(`  Found dealer in column ${colLetter} (index ${dealerColIdx})`);

  // Read current values
  const currentWebsite = rows[7]?.[dealerColIdx]?.toString().trim() || ''; // Row 8 (0-indexed: 7)
  const currentPhone = rows[8]?.[dealerColIdx]?.toString().trim() || '';   // Row 9 (0-indexed: 8)

  console.log(`  Current Row 8 (Website): "${currentWebsite}"`);
  console.log(`  Current Row 9 (Phone): "${currentPhone}"`);
  console.log(`  Correct phone: "${CORRECT_PHONE}"`);
  console.log(`  Correct website: "${CORRECT_WEBSITE}" (none)`);

  if (applyMode) {
    const updates = [
      { range: `Sheet1!${colLetter}8`, values: [[CORRECT_WEBSITE]] },  // Row 8: Website
      { range: `Sheet1!${colLetter}9`, values: [[CORRECT_PHONE]] },   // Row 9: Phone
    ];

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates,
      },
    });
    console.log(`  -> APPLIED: Updated ${colLetter}8 (website) and ${colLetter}9 (phone)`);
  } else {
    console.log(`  -> DRY RUN: Would update ${colLetter}8="" and ${colLetter}9="${CORRECT_PHONE}"`);
  }

  // Also update post copy rows that contain the old phone number (740-922-5252)
  const oldPhone = '740-922-5252';
  let postCopyFixCount = 0;
  const postCopyUpdates: Array<{ range: string; values: string[][] }> = [];

  for (let rowIdx = 12; rowIdx < rows.length; rowIdx++) { // Row 13+ (0-indexed: 12+)
    const cellValue = rows[rowIdx]?.[dealerColIdx]?.toString() || '';
    if (cellValue.includes(oldPhone)) {
      const fixedValue = cellValue.replace(new RegExp(oldPhone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), CORRECT_PHONE);
      const rowNum = rowIdx + 1;
      postCopyUpdates.push({
        range: `Sheet1!${colLetter}${rowNum}`,
        values: [[fixedValue]],
      });
      postCopyFixCount++;
    }
  }

  if (postCopyFixCount > 0) {
    console.log(`  Found ${postCopyFixCount} post copy rows with old phone "${oldPhone}" to fix`);
    if (applyMode) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          valueInputOption: 'RAW',
          data: postCopyUpdates,
        },
      });
      console.log(`  -> APPLIED: Fixed ${postCopyFixCount} post copy rows`);
    } else {
      console.log(`  -> DRY RUN: Would fix ${postCopyFixCount} post copy rows`);
    }
  }

  // Find last 6 posts from scheduling spreadsheet (column A, row 13+)
  const last6Posts: Array<{ postNumber: number; rowNumber: number }> = [];
  for (let rowIdx = rows.length - 1; rowIdx >= 12 && last6Posts.length < 6; rowIdx--) {
    const postNum = parseInt(rows[rowIdx]?.[0]?.toString() || '');
    if (!isNaN(postNum) && postNum > 0) {
      last6Posts.unshift({ postNumber: postNum, rowNumber: rowIdx + 1 });
    }
  }

  console.log(`\n  Last 6 posts on scheduling spreadsheet:`);
  for (const p of last6Posts) {
    console.log(`    Post ${p.postNumber} (Row ${p.rowNumber})`);
  }

  return { dealerCol: colLetter, last6Posts };
}

async function fixAlliedExcel(): Promise<boolean> {
  console.log('\n=== STEP 3: Allied Air Excel (Microsoft Graph API) ===');

  try {
    const client = await getAuthenticatedGraphClient();

    // Get drive and file info
    const userResponse = await client.api(`/users/${DRIVE_OWNER_EMAIL}/drive`).get();
    const driveId = userResponse.id;

    const fileResponse = await client.api(`/drives/${driveId}/root:${FILE_PATH}`).get();
    const fileId = fileResponse.id;
    console.log(`  File: ${fileResponse.name} (last modified: ${fileResponse.lastModifiedDateTime})`);

    // Use workbook API to read the Dealer No column (D) to find the row
    // Read a range that includes column D (Dealer No), M (TurnkeyURL), and V (Dealer Web Address)
    // Excel workbook API uses 1-based row numbering

    // First, find the dealer row by reading column D
    const rangeResponse = await client
      .api(`/drives/${driveId}/items/${fileId}/workbook/worksheets/${encodeURIComponent(SHEET_NAME)}/range(address='D1:D500')`)
      .get();

    const dValues = rangeResponse.values as any[][];
    let dealerRowIdx = -1; // 0-based index in the values array

    for (let i = 0; i < dValues.length; i++) {
      let cellVal = dValues[i]?.[0];
      if (cellVal === null || cellVal === undefined) continue;

      // Handle number formatting
      if (typeof cellVal === 'number') {
        cellVal = Math.floor(cellVal).toString();
      } else {
        cellVal = cellVal.toString().trim();
      }

      if (cellVal === DEALER_NO) {
        dealerRowIdx = i;
        break;
      }
    }

    if (dealerRowIdx < 0) {
      console.error(`  Dealer ${DEALER_NO} not found in Allied Excel column D!`);
      return false;
    }

    const excelRow = dealerRowIdx + 1; // Excel uses 1-based rows
    console.log(`  Found dealer in Excel row ${excelRow}`);

    // Read current values of M (TurnkeyURL) and V (Dealer Web Address)
    const currentMResponse = await client
      .api(`/drives/${driveId}/items/${fileId}/workbook/worksheets/${encodeURIComponent(SHEET_NAME)}/range(address='M${excelRow}')`)
      .get();
    const currentVResponse = await client
      .api(`/drives/${driveId}/items/${fileId}/workbook/worksheets/${encodeURIComponent(SHEET_NAME)}/range(address='V${excelRow}')`)
      .get();

    const currentTurnkeyUrl = currentMResponse.values?.[0]?.[0]?.toString() || '';
    const currentDealerWebAddress = currentVResponse.values?.[0]?.[0]?.toString() || '';

    console.log(`  Current M${excelRow} (TurnkeyURL): "${currentTurnkeyUrl}"`);
    console.log(`  Current V${excelRow} (Dealer Web Address): "${currentDealerWebAddress}"`);

    // Also read current phone values to verify they're correct
    const currentLResponse = await client
      .api(`/drives/${driveId}/items/${fileId}/workbook/worksheets/${encodeURIComponent(SHEET_NAME)}/range(address='L${excelRow}')`)
      .get();
    const currentQResponse = await client
      .api(`/drives/${driveId}/items/${fileId}/workbook/worksheets/${encodeURIComponent(SHEET_NAME)}/range(address='Q${excelRow}')`)
      .get();

    const currentTurnkeyPhone = currentLResponse.values?.[0]?.[0]?.toString() || '';
    const currentContactPhone = currentQResponse.values?.[0]?.[0]?.toString() || '';

    console.log(`  Current L${excelRow} (TurnkeyPhone): "${currentTurnkeyPhone}" ${currentTurnkeyPhone.includes('604-798-5981') ? '(CORRECT)' : '(CHECK)'}`);
    console.log(`  Current Q${excelRow} (Contact Phone): "${currentContactPhone}" ${currentContactPhone.includes('604-798-5981') || !currentContactPhone ? '(OK)' : '(CHECK)'}`);

    if (!currentTurnkeyUrl && !currentDealerWebAddress) {
      console.log('  -> Website fields already empty, no changes needed.');
      return true;
    }

    if (applyMode) {
      // Clear TurnkeyURL (M)
      if (currentTurnkeyUrl) {
        await client
          .api(`/drives/${driveId}/items/${fileId}/workbook/worksheets/${encodeURIComponent(SHEET_NAME)}/range(address='M${excelRow}')`)
          .patch({ values: [['']] });
        console.log(`  -> APPLIED: Cleared M${excelRow} (TurnkeyURL)`);
      }

      // Clear Dealer Web Address (V)
      if (currentDealerWebAddress) {
        await client
          .api(`/drives/${driveId}/items/${fileId}/workbook/worksheets/${encodeURIComponent(SHEET_NAME)}/range(address='V${excelRow}')`)
          .patch({ values: [['']] });
        console.log(`  -> APPLIED: Cleared V${excelRow} (Dealer Web Address)`);
      }
    } else {
      console.log(`  -> DRY RUN: Would clear M${excelRow} and V${excelRow}`);
    }

    return true;
  } catch (error: unknown) {
    console.error('  Allied Excel update error:', error instanceof Error ? error.message : error);
    console.log('  -> Skipping Allied Excel update. You may need to update it manually.');
    return false;
  }
}

async function triggerReRenders(last6Posts: Array<{ postNumber: number; rowNumber: number }>) {
  console.log('\n=== STEP 4: Re-render Last 6 Posts ===');

  if (last6Posts.length === 0) {
    console.log('  No posts found to re-render.');
    return;
  }

  // Look up template IDs from Firestore posts collection
  const { db } = await import('../lib/firebase');

  const postsWithTemplates: Array<{ postNumber: number; templateId: string }> = [];

  for (const post of last6Posts) {
    const postDoc = await db.collection('posts').doc(post.postNumber.toString()).get();
    if (postDoc.exists) {
      const templateId = postDoc.data()?.templateId;
      if (templateId) {
        postsWithTemplates.push({ postNumber: post.postNumber, templateId });
        console.log(`  Post ${post.postNumber}: template ${templateId.substring(0, 8)}...`);
      } else {
        console.log(`  Post ${post.postNumber}: NO template ID in Firestore (skipping)`);
      }
    } else {
      console.log(`  Post ${post.postNumber}: NOT in Firestore posts collection (skipping)`);
    }
  }

  if (postsWithTemplates.length === 0) {
    console.log('  No posts with template IDs found. Cannot re-render.');
    return;
  }

  console.log(`\n  ${postsWithTemplates.length} posts ready for re-render (dealer ${DEALER_NO} only)`);

  if (renderMode && applyMode) {
    // Import render queue functions
    const { createRenderBatch, createRenderJob } = await import('../lib/renderQueue');
    const { getDealer } = await import('../lib/firestore-dealers');

    const dealer = await getDealer(DEALER_NO);
    if (!dealer || !dealer.creatomate_logo) {
      console.error('  Cannot render: dealer missing logo or not found');
      return;
    }

    for (const post of postsWithTemplates) {
      const batchId = await createRenderBatch({
        postNumber: post.postNumber,
        templateId: post.templateId,
        totalJobs: 1,
        createdBy: 'fix-script',
      });

      await createRenderJob({
        batchId,
        businessId: DEALER_NO,
        businessName: dealer.display_name || 'Ron\'s Heating and Cooling',
        postNumber: post.postNumber,
        templateId: post.templateId,
      });

      console.log(`  -> QUEUED: Post ${post.postNumber} batch ${batchId}`);
    }

    console.log(`\n  ${postsWithTemplates.length} render jobs queued. Cron will process at 25 jobs/min.`);
  } else if (!renderMode) {
    console.log('  -> Not rendering (use --render --apply to trigger re-renders)');
  } else {
    console.log('  -> DRY RUN: Would queue re-renders (use --apply --render)');
  }
}

async function main() {
  console.log('========================================');
  console.log(`Fix Dealer ${DEALER_NO} - Ron's Heating and Cooling (BC, Canada)`);
  console.log(`Mode: ${applyMode ? 'APPLY' : 'DRY RUN'}${renderMode ? ' + RENDER' : ''}`);
  console.log('========================================');

  // Step 1: Firestore
  await fixFirestore();

  // Step 2: Google Sheets
  const { last6Posts } = await fixGoogleSheets();

  // Step 3: Allied Air Excel
  await fixAlliedExcel();

  // Step 4: Re-renders
  await triggerReRenders(last6Posts);

  console.log('\n========================================');
  if (applyMode) {
    console.log('ALL FIXES APPLIED');
    if (renderMode) {
      console.log('Render jobs queued - check /admin for progress');
    }
  } else {
    console.log('DRY RUN COMPLETE - No changes made');
    console.log('Run with --apply to apply fixes');
    console.log('Run with --apply --render to also re-render');
  }
  console.log('========================================\n');

  // Exit cleanly
  process.exit(0);
}

main().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
