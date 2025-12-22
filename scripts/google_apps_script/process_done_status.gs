/**
 * Process Done Status - Google Apps Script
 *
 * This script runs on Google's servers and:
 * 1. Scans the scheduling spreadsheet for "Done" status
 * 2. Sends emails via Resend API
 * 3. Updates status to "Email Sent"
 * 4. Tracks first_post vs post_scheduled in a new row
 *
 * Setup:
 * 1. Open https://script.google.com
 * 2. Create new project
 * 3. Paste this code
 * 4. Set Script Properties (Project Settings > Script Properties):
 *    - RESEND_API_KEY: Your Resend API key
 * 5. Run processDoneStatus() once manually to authorize
 * 6. Set up trigger: Triggers > Add Trigger > processDoneStatus > Time-driven > Every hour
 */

// Configuration
const SPREADSHEET_ID = '1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY';
const SHEET_NAME = 'Sheet1';

// Row indices (1-based)
const ROW_DEALER_NO = 1;
const ROW_EMAIL_STATUS = 2;
const ROW_FIRST_NAME = 5;
const ROW_EMAIL = 6;
const ROW_FIRST_POST_SENT = 12; // New row to track if first_post email was sent (repurposing row 12 header area or add new)

// Column where dealers start (1-based for Apps Script)
const COL_DEALERS_START = 7; // Column G

// Email templates
const FIRST_POST_SUBJECT = 'Your Social Media Posts Are Now Scheduled!';
const POST_SCHEDULED_SUBJECT = 'Your Latest Social Media Content Has Been Scheduled';

/**
 * Main function - run this on a schedule
 */
function processDoneStatus() {
  const startTime = new Date();
  Logger.log('='.repeat(60));
  Logger.log('Processing Done Status - ' + startTime.toISOString());
  Logger.log('='.repeat(60));

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const lastCol = sheet.getLastColumn();

  // Get rows 1, 2, 5, 6, and 12 for all columns
  const dealerRow = sheet.getRange(ROW_DEALER_NO, 1, 1, lastCol).getValues()[0];
  const statusRow = sheet.getRange(ROW_EMAIL_STATUS, 1, 1, lastCol).getValues()[0];
  const firstNameRow = sheet.getRange(ROW_FIRST_NAME, 1, 1, lastCol).getValues()[0];
  const emailRow = sheet.getRange(ROW_EMAIL, 1, 1, lastCol).getValues()[0];

  // Check if row 12 has first_post tracking (we'll use column F as the label)
  let firstPostRow;
  try {
    firstPostRow = sheet.getRange(ROW_FIRST_POST_SENT, 1, 1, lastCol).getValues()[0];
  } catch (e) {
    firstPostRow = [];
  }

  // Find dealers with "Done" status
  const doneDealers = [];
  for (let col = COL_DEALERS_START - 1; col < lastCol; col++) {
    const status = String(statusRow[col] || '').trim().toLowerCase();
    if (status === 'done') {
      const dealerNo = String(dealerRow[col] || '').trim();
      const firstName = String(firstNameRow[col] || '').trim() || 'there';
      const email = String(emailRow[col] || '').trim();
      const hasReceivedFirstPost = String(firstPostRow[col] || '').trim().toLowerCase() === 'yes';

      if (dealerNo && email) {
        doneDealers.push({
          dealerNo: dealerNo,
          firstName: firstName,
          email: email,
          column: col + 1, // Convert to 1-based
          hasReceivedFirstPost: hasReceivedFirstPost
        });
      }
    }
  }

  Logger.log('Found ' + doneDealers.length + ' dealer(s) with "Done" status');

  if (doneDealers.length === 0) {
    Logger.log('Nothing to process');
    return;
  }

  // Process each dealer
  let processed = 0;
  let errors = 0;

  for (const dealer of doneDealers) {
    Logger.log('');
    Logger.log('Processing ' + dealer.dealerNo + ' (column ' + dealer.column + ')...');

    const emailType = dealer.hasReceivedFirstPost ? 'post_scheduled' : 'first_post';
    Logger.log('  Will send: ' + emailType);

    try {
      // Send email
      const result = sendEmail(dealer, emailType);

      if (result.success) {
        Logger.log('  Email sent successfully');

        // Update status to "Email Sent"
        sheet.getRange(ROW_EMAIL_STATUS, dealer.column).setValue('Email Sent');

        // Mark first_post as sent if this was the first email
        if (emailType === 'first_post') {
          sheet.getRange(ROW_FIRST_POST_SENT, dealer.column).setValue('yes');
        }

        processed++;
      } else {
        Logger.log('  Email failed: ' + result.error);
        errors++;
      }
    } catch (e) {
      Logger.log('  Error: ' + e.message);
      errors++;
    }
  }

  // Summary
  Logger.log('');
  Logger.log('='.repeat(60));
  Logger.log('Summary:');
  Logger.log('  Processed: ' + processed);
  Logger.log('  Errors: ' + errors);
  Logger.log('='.repeat(60));
}

/**
 * Send email via Resend API
 */
function sendEmail(dealer, emailType) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('RESEND_API_KEY');

  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  const subject = emailType === 'first_post' ? FIRST_POST_SUBJECT : POST_SCHEDULED_SUBJECT;
  const htmlBody = emailType === 'first_post'
    ? getFirstPostEmailHtml(dealer.firstName)
    : getPostScheduledEmailHtml(dealer.firstName);

  const payload = {
    from: 'Woodhouse Social Community Managers <communitymanagers@woodhouseagency.com>',
    to: dealer.email,
    subject: subject,
    html: htmlBody
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch('https://api.resend.com/emails', options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode === 200 || responseCode === 201) {
      Logger.log('  Sent to: ' + dealer.email);
      return { success: true };
    } else {
      return { success: false, error: 'API returned ' + responseCode + ': ' + responseBody };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * First Post Scheduled Email HTML
 */
function getFirstPostEmailHtml(firstName) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Social Media Posts Are Now Scheduled!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <p>Hi ${firstName},</p>

  <p>Great news! We've scheduled your first batch of social media posts.</p>

  <p>Here's what happens next:</p>
  <ul>
    <li>Your posts will be published automatically on the scheduled dates</li>
    <li>We'll continue to create and schedule fresh content for you</li>
    <li>You'll receive an email each time new posts are scheduled</li>
  </ul>

  <p>You don't need to do anything - we've got it covered!</p>

  <p>If you have any questions or want to discuss your social media strategy, just reply to this email.</p>

  <p>Best regards,<br>
  <strong>Woodhouse Social Community Managers</strong></p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="font-size: 12px; color: #666;">
    This email was sent by Woodhouse Agency on behalf of Allied Air Enterprises.
  </p>

</body>
</html>`;
}

/**
 * Post Scheduled Email HTML
 */
function getPostScheduledEmailHtml(firstName) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Latest Social Media Content Has Been Scheduled</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <p>Hi ${firstName},</p>

  <p>We've scheduled your latest social media posts!</p>

  <p>Your new content is ready to go and will be published automatically on the scheduled dates.</p>

  <p>As always, if you have any questions or feedback about your social media content, just reply to this email.</p>

  <p>Best regards,<br>
  <strong>Woodhouse Social Community Managers</strong></p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="font-size: 12px; color: #666;">
    This email was sent by Woodhouse Agency on behalf of Allied Air Enterprises.
  </p>

</body>
</html>`;
}

/**
 * Test function - run manually to test email sending
 */
function testEmail() {
  const testDealer = {
    dealerNo: 'TEST',
    firstName: 'Greg',
    email: 'heygregwood@gmail.com',
    column: 0,
    hasReceivedFirstPost: false
  };

  const result = sendEmail(testDealer, 'first_post');
  Logger.log('Test result: ' + JSON.stringify(result));
}

/**
 * Check current status - run manually to see what would be processed
 */
function checkStatus() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const lastCol = sheet.getLastColumn();

  const dealerRow = sheet.getRange(ROW_DEALER_NO, 1, 1, lastCol).getValues()[0];
  const statusRow = sheet.getRange(ROW_EMAIL_STATUS, 1, 1, lastCol).getValues()[0];

  Logger.log('Current status of all dealers:');
  for (let col = COL_DEALERS_START - 1; col < lastCol; col++) {
    const dealerNo = String(dealerRow[col] || '').trim();
    const status = String(statusRow[col] || '').trim();
    if (dealerNo) {
      Logger.log('  ' + dealerNo + ': ' + status);
    }
  }
}
