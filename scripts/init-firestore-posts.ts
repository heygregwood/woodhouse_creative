/**
 * Initialize Firestore Posts Collection
 *
 * Reads active post numbers from scheduling spreadsheet (column A, rows 13+),
 * uses template mapping from posts-template-mapping.json,
 * creates Firestore posts collection with mapping.
 *
 * Usage:
 *   npx tsx scripts/init-firestore-posts.ts
 */

import { google } from 'googleapis';
import { db } from '../lib/firebase';
import * as fs from 'fs';
import * as path from 'path';

const SPREADSHEET_ID = '1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY';
const ROW_POSTS_START = 13;
const TEMPLATE_MAPPING_PATH = path.join(__dirname, 'posts-template-mapping.json');

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
 * Load template mapping from JSON file
 */
function loadTemplateMapping(): Record<string, string> {
  const jsonData = fs.readFileSync(TEMPLATE_MAPPING_PATH, 'utf-8');
  return JSON.parse(jsonData);
}

/**
 * Read active post numbers from spreadsheet
 */
async function getActivePostsFromSpreadsheet(): Promise<Array<{
  postNumber: number;
  baseCopy: string;
}>> {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('[init-posts] Reading active posts from spreadsheet...');

  // Read columns A and C from row 13 onwards
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Sheet1!A13:C1000'
  });

  const rows = response.data.values || [];
  const posts: Array<{ postNumber: number; baseCopy: string }> = [];

  for (const row of rows) {
    const postNumberStr = row[0]?.toString().trim();
    const baseCopy = row[2]?.toString().trim() || '';

    if (!postNumberStr) {
      continue; // Skip empty rows
    }

    const postNumber = parseInt(postNumberStr, 10);

    if (isNaN(postNumber)) {
      console.log(`[init-posts] Skipping non-numeric post number: "${postNumberStr}"`);
      continue;
    }

    posts.push({ postNumber, baseCopy });
  }

  console.log(`[init-posts] Found ${posts.length} active posts`);
  return posts;
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('[init-posts] Starting Firestore posts collection initialization...');

    // 1. Load template mapping
    const templateMapping = loadTemplateMapping();
    console.log(`[init-posts] Loaded ${Object.keys(templateMapping).length} template mappings`);

    // 2. Get active posts from spreadsheet
    const posts = await getActivePostsFromSpreadsheet();

    if (posts.length === 0) {
      console.log('[init-posts] No posts found in spreadsheet');
      return;
    }

    // 3. Create Firestore documents
    console.log('[init-posts] Creating Firestore documents...');
    const postsCollection = db.collection('posts');
    let successCount = 0;
    let failedCount = 0;

    for (const post of posts) {
      try {
        const templateId = templateMapping[post.postNumber.toString()];

        if (!templateId) {
          console.log(`[init-posts] ⚠️  Template ID not found for post ${post.postNumber}`);
          failedCount++;
          continue;
        }

        // Create Firestore document
        await postsCollection.doc(post.postNumber.toString()).set({
          postNumber: post.postNumber,
          templateId,
          baseCopy: post.baseCopy,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        console.log(`[init-posts] ✓ Post ${post.postNumber} → Template ${templateId.substring(0, 8)}...`);
        successCount++;

      } catch (error) {
        console.error(`[init-posts] Error processing post ${post.postNumber}:`, error);
        failedCount++;
      }
    }

    console.log(`\n[init-posts] ✅ Initialization complete`);
    console.log(`[init-posts] Success: ${successCount}`);
    console.log(`[init-posts] Failed: ${failedCount}`);

  } catch (error) {
    console.error('[init-posts] Fatal error:', error);
    process.exit(1);
  }
}

main();
