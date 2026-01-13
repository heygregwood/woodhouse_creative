#!/usr/bin/env npx tsx
/**
 * Test Microsoft Graph API authentication with device code flow
 *
 * Usage:
 *   cd ~/woodhouse_creative
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/test-microsoft-auth.ts
 *
 * This script will:
 * 1. Check for cached token
 * 2. If no valid token, prompt for device code authentication
 * 3. Test connection by listing files in your OneDrive
 */

import { getAuthenticatedGraphClient, hasValidToken, clearTokenCache, getCachedAccountInfo } from '../lib/microsoft-auth';

const DRIVE_OWNER_EMAIL = process.env.SHAREPOINT_OWNER_EMAIL || 'greg@woodhouseagency.com';
const FILE_PATH = process.env.SHAREPOINT_FILE_PATH || '/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database/Turnkey Social Media - Dealers - Current.xlsm';

async function main() {
  const args = process.argv.slice(2);

  // Check for --clear flag to force re-authentication
  if (args.includes('--clear')) {
    console.log('Clearing token cache...');
    clearTokenCache();
    console.log('Done. Run again without --clear to authenticate.');
    return;
  }

  // Check for --status flag
  if (args.includes('--status')) {
    console.log('Token status:', hasValidToken() ? 'Valid token cached' : 'No valid token');
    const account = await getCachedAccountInfo();
    if (account) {
      console.log('Cached account:', account.username);
    }
    return;
  }

  console.log('=== Microsoft Graph API Authentication Test ===\n');

  // Check if we have a cached token
  if (hasValidToken()) {
    console.log('Found valid cached token.\n');
  } else {
    console.log('No cached token found. Starting device code authentication...\n');
  }

  try {
    // Get authenticated client (will prompt for device code if needed)
    const client = await getAuthenticatedGraphClient();

    console.log('\nAuthentication successful! Testing Graph API access...\n');

    // Test 1: Get user info
    console.log('Test 1: Getting user profile...');
    const user = await client.api('/me').get();
    console.log(`  Logged in as: ${user.displayName} (${user.mail})\n`);

    // Test 2: Get the user's OneDrive
    console.log(`Test 2: Getting OneDrive for ${DRIVE_OWNER_EMAIL}...`);
    const driveResponse = await client.api(`/users/${DRIVE_OWNER_EMAIL}/drive`).get();
    console.log(`  Drive ID: ${driveResponse.id}`);
    console.log(`  Drive Type: ${driveResponse.driveType}`);
    console.log(`  Owner: ${driveResponse.owner?.user?.displayName || 'Unknown'}\n`);

    // Test 3: Get the Excel file info
    console.log(`Test 3: Getting Excel file info...`);
    console.log(`  Path: ${FILE_PATH}`);
    try {
      const fileResponse = await client
        .api(`/drives/${driveResponse.id}/root:${FILE_PATH}`)
        .get();
      console.log(`  File found!`);
      console.log(`  Name: ${fileResponse.name}`);
      console.log(`  Size: ${(fileResponse.size / 1024).toFixed(1)} KB`);
      console.log(`  Last modified: ${fileResponse.lastModifiedDateTime}`);
      console.log(`  Web URL: ${fileResponse.webUrl}\n`);

      // Test 4: Try to read the Excel workbook (this is what failed before)
      console.log('Test 4: Testing Excel workbook API access...');
      try {
        const worksheets = await client
          .api(`/drives/${driveResponse.id}/items/${fileResponse.id}/workbook/worksheets`)
          .get();
        console.log(`  SUCCESS! Found ${worksheets.value.length} worksheets:`);
        for (const sheet of worksheets.value) {
          console.log(`    - ${sheet.name}`);
        }
        console.log('\n✅ All tests passed! Excel sync should work now.');
      } catch (error) {
        console.log(`  Excel API error: ${error}`);
        console.log('  This may indicate the file is not a valid Excel workbook or is corrupted.');
      }
    } catch (error) {
      console.log(`  Could not find file: ${error}`);
      console.log('  Check that SHAREPOINT_FILE_PATH is correct.');
    }
  } catch (error) {
    console.error('\n❌ Authentication failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
