/**
 * New Dealer Welcome Email - Google Apps Script
 *
 * Location: communitymanagers@woodhouseagency.com Apps Script
 * Name: "New Dealer Welcome Email"
 *
 * This script runs on Google's servers and:
 * 1. Receives webhook POST from Excel VBA automation
 * 2. Appends dealer data to welcome email sheet
 * 3. Sets ScheduledDate = now() so Mail Merge addon auto-sends
 *
 * Setup:
 * 1. Open https://script.google.com
 * 2. Create new project named "New Dealer Welcome Email"
 * 3. Paste this code
 * 4. Deploy as Web App (Execute as: Me, Access: Anyone)
 * 5. Copy the web app URL for Excel VBA to call
 */

/*** CONFIG – adjust these to your sheet ***/
const SHEET_NAME = 'Sheet1'; // tab name in your spreadsheet
const INBOUND_SECRET = 'j3K2jif3*#fjjkf3oifsljjFSADfeu23jliAGEueiohg@#9HFu32fu32o8jsjhlkhEIHJFWHLOEHFJLKHskljhhjlefh?jLSjh';

// Map your columns A..K
const COLS = [
  'Brand',           // A
  'Distributor',     // B
  'BusinessName',    // C
  'FirstName',       // D
  'LastName',        // E
  'Tier',            // F
  'VideoLink',       // G
  'EmailAddress',    // H
  'FileAttachment',  // I (Drive link the add-on will use)
  'ScheduledDate',   // J (we'll set NOW)
  'MailMergeStatus'  // K (empty so add-on picks it up)
];

/**
 * Receive POSTs from Excel, append to the sheet, and set Scheduled Date = now()
 * so the Mail Merge add-on auto-sends it.
 *
 * Expected JSON body:
 * {
 *   "secret":"<must match INBOUND_SECRET>",
 *   "Brand":"Armstrong Air",
 *   "Distributor":"Johnson Supply",
 *   "BusinessName":"Comfort Connect",
 *   "FirstName":"Ruben",
 *   "LastName":"Flores",
 *   "Tier":"A",
 *   "VideoLink":"https://…",
 *   "EmailAddress":"someone@domain.com",
 *   "FileAttachment":"https://drive.google.com/file/d/FILE_ID/view?usp=sharing"
 * }
 */
function doPost(e) {
  try {
    const body = e?.postData?.type?.includes('json')
      ? JSON.parse(e.postData.contents)
      : e.parameter;

    if (!body || body.secret !== INBOUND_SECRET) {
      return ContentService
        .createTextOutput('Unauthorized')
        .setMimeType(ContentService.MimeType.TEXT);
    }

    const now = new Date();
    const row = [
      body.Brand || '',
      body.Distributor || '',
      body.BusinessName || '',
      body.FirstName || '',
      body.LastName || '',
      body.Tier || '',
      body.VideoLink || '',
      body.EmailAddress || '',
      body.FileAttachment || '',
      now,     // Scheduled Date (J) – add-on will send soon after this time
      ''       // Status (K) – keep empty so add-on picks it up
    ];

    const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    sh.appendRow(row);

    // Format the Scheduled Date column as your sheet expects (optional)
    const r = sh.getLastRow();
    sh.getRange(r, 10).setNumberFormat('mmm-dd-yy h:mm AM/PM');

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, row: r }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Test function - verify the script is working
 */
function testAppend() {
  const testData = {
    Brand: 'Armstrong Air',
    Distributor: 'Test Distributor',
    BusinessName: 'Test Business',
    FirstName: 'Test',
    LastName: 'User',
    Tier: 'A',
    VideoLink: 'https://example.com/video',
    EmailAddress: 'test@example.com',
    FileAttachment: ''
  };

  const now = new Date();
  const row = [
    testData.Brand,
    testData.Distributor,
    testData.BusinessName,
    testData.FirstName,
    testData.LastName,
    testData.Tier,
    testData.VideoLink,
    testData.EmailAddress,
    testData.FileAttachment,
    now,
    ''
  ];

  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  sh.appendRow(row);

  Logger.log('Test row appended successfully');
}
