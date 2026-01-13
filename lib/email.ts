/**
 * TypeScript Email Module - Replaces Python send_email.py
 *
 * Handles all dealer email notifications using Resend API
 * Updates Google Sheets spreadsheet status after sending
 */

import { google } from 'googleapis';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { isDealerBlocked } from '@/lib/blocked-dealers';

// Constants
const RESEND_API_URL = 'https://api.resend.com/emails';
const SPREADSHEET_ID = '1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY';
const DB_PATH = path.join(process.cwd(), 'data', 'sqlite', 'creative.db');
const TEMPLATES_PATH = path.join(process.cwd(), 'templates', 'emails');

const FROM_EMAIL = 'communitymanagers@woodhouseagency.com';
const FROM_NAME = 'Woodhouse Social Community Managers';

const ROW_DEALER_NO = 0;      // Row 1: Dealer numbers
const ROW_EMAIL_STATUS = 1;   // Row 2: Schedule Email Status
const COL_DEALERS_START = 6;  // Column G: First dealer column

// Brand-specific video links
const BRAND_VIDEOS = {
  armstrong_air: 'https://vimeo.com/910160703/51df1eb27d',
  airease: 'https://vimeo.com/914492643'
};

const FB_ADMIN_GUIDE_URL = 'https://drive.google.com/file/d/1MEe7lybJ6oghz5pJOZvUaXdSu4m279CI/view?usp=share_link';

// Type definitions
export interface DealerData {
  dealer_no: string;
  display_name: string;
  contact_first_name: string | null;
  contact_email: string | null;
  distributor_name: string | null;
  program_status: string;
  armstrong_air: number;
  airease: number;
}

export interface EmailResult {
  success: boolean;
  error?: string;
  blocked?: boolean;
  dev_mode?: boolean;
  response?: any;
}

export interface BrandInfo {
  brand: string;
  video_url: string;
}

/**
 * Get authenticated Google Sheets service
 */
function getGoogleAuth() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!serviceAccountEmail || !privateKey) {
    return null;
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
 * Update the Schedule Email Status in the spreadsheet for a dealer
 */
export async function updateEmailStatus(dealerNo: string, status: string = 'Email Sent'): Promise<boolean> {
  try {
    const auth = getGoogleAuth();
    if (!auth) {
      console.log('[email] No Google credentials - skipping spreadsheet update');
      return false;
    }

    const sheets = google.sheets({ version: 'v4', auth });

    // Read row 1 to find dealer column
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!1:1'
    });

    const row1 = response.data.values?.[0] || [];

    // Find the column for this dealer
    let colIdx: number | null = null;
    for (let i = COL_DEALERS_START; i < row1.length; i++) {
      let cellValue = String(row1[i]).trim();

      // Handle float formatting issues
      try {
        if (cellValue.includes('.') || cellValue.toUpperCase().includes('E')) {
          cellValue = String(Math.floor(parseFloat(cellValue)));
        }
      } catch {
        // Keep original
      }

      if (cellValue === dealerNo) {
        colIdx = i;
        break;
      }
    }

    if (colIdx === null) {
      console.log(`[email] Dealer ${dealerNo} not found in spreadsheet`);
      return false;
    }

    // Convert to column letter
    let colLetter: string;
    if (colIdx < 26) {
      colLetter = String.fromCharCode(65 + colIdx);
    } else {
      colLetter = String.fromCharCode(64 + Math.floor(colIdx / 26)) + String.fromCharCode(65 + (colIdx % 26));
    }

    // Update row 2 (Email Status)
    const cellRef = `Sheet1!${colLetter}2`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: cellRef,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[status]]
      }
    });

    console.log(`[email] Updated spreadsheet: ${colLetter}2 = '${status}'`);
    return true;

  } catch (error: unknown) {
    console.error('[email] Failed to update spreadsheet:', error);
    return false;
  }
}

/**
 * Fetch dealer data from database
 */
export function getDealer(dealerNo: string): DealerData | null {
  const db = new Database(DB_PATH, { readonly: true });

  const dealer = db.prepare(`
    SELECT
      dealer_no,
      display_name,
      contact_first_name,
      contact_email,
      distributor_name,
      program_status,
      armstrong_air,
      airease
    FROM dealers
    WHERE dealer_no = ?
  `).get(dealerNo) as DealerData | undefined;

  db.close();

  return dealer || null;
}

/**
 * Determine brand and video link from dealer data
 */
export function getBrandInfo(dealer: DealerData): BrandInfo {
  // Default to Armstrong Air if both or neither
  if (dealer.airease === 1 && dealer.armstrong_air !== 1) {
    return {
      brand: 'AirEase',
      video_url: BRAND_VIDEOS.airease
    };
  }
  return {
    brand: 'Armstrong Air',
    video_url: BRAND_VIDEOS.armstrong_air
  };
}

/**
 * Load HTML template from templates/emails directory
 */
export function loadTemplate(templateName: string): string {
  const templatePath = path.join(TEMPLATES_PATH, `${templateName}.html`);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  return fs.readFileSync(templatePath, 'utf-8');
}

/**
 * Replace {{variable}} placeholders with actual values
 */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value || '');
  }
  return result;
}

/**
 * Send email via Resend API
 */
export async function sendEmail(
  toEmail: string,
  subject: string,
  htmlBody: string,
  options: {
    replyTo?: string;
    fromName?: string;
    fromEmail?: string;
  } = {}
): Promise<EmailResult> {
  const senderName = options.fromName || FROM_NAME;
  const senderEmail = options.fromEmail || FROM_EMAIL;
  const replyAddress = options.replyTo || senderEmail;

  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    // Dev mode - just log
    console.log(`[DEV MODE - EMAIL NOT SENT]
To: ${toEmail}
Subject: ${subject}
From: ${senderName} <${senderEmail}>
---
${htmlBody.substring(0, 500)}...`);
    return { success: true, dev_mode: true };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: toEmail,
        subject: subject,
        html: htmlBody,
        reply_to: replyAddress
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`[email] Sent to ${toEmail}: ${subject}`);
      return { success: true, response: result };
    } else {
      const errorText = await response.text();
      console.error(`[email] Failed to ${toEmail}:`, errorText);
      return { success: false, error: errorText };
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[email] Error sending to ${toEmail}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

// ============================================================================
// EMAIL FUNCTIONS
// ============================================================================

/**
 * Send Welcome Email to new dealer
 * Trigger: New dealer added to program (status = CONTENT or FULL)
 */
export async function sendWelcomeEmail(dealerNo: string): Promise<EmailResult> {
  // Check blocklist (test accounts, etc.)
  if (isDealerBlocked(dealerNo)) {
    console.log(`[email] Dealer ${dealerNo} is blocked - skipping email`);
    return { success: false, error: `Dealer ${dealerNo} is blocked from emails`, blocked: true };
  }

  const dealer = getDealer(dealerNo);
  if (!dealer) {
    return { success: false, error: `Dealer not found: ${dealerNo}` };
  }

  if (!dealer.contact_email) {
    return { success: false, error: `No email for dealer: ${dealerNo}` };
  }

  const brandInfo = getBrandInfo(dealer);

  const variables = {
    first_name: dealer.contact_first_name || 'there',
    business_name: dealer.display_name || '',
    distributor: dealer.distributor_name || 'your distributor',
    brand: brandInfo.brand,
    video_url: brandInfo.video_url,
    fb_admin_guide_url: FB_ADMIN_GUIDE_URL
  };

  const template = loadTemplate('welcome');
  const htmlBody = renderTemplate(template, variables);

  const subject = `Welcome to the ${variables.distributor} Turnkey Social Media Program`;

  return sendEmail(dealer.contact_email, subject, htmlBody);
}

/**
 * Send FB Admin Accepted Email
 * Trigger: When we accept a dealer's Facebook admin invite (CONTENT -> FULL)
 */
export async function sendFbAdminAcceptedEmail(
  dealerNo: string,
  updateSpreadsheet: boolean = true
): Promise<EmailResult> {
  // Check blocklist (test accounts, etc.)
  if (isDealerBlocked(dealerNo)) {
    console.log(`[email] Dealer ${dealerNo} is blocked - skipping email`);
    return { success: false, error: `Dealer ${dealerNo} is blocked from emails`, blocked: true };
  }

  const dealer = getDealer(dealerNo);
  if (!dealer) {
    return { success: false, error: `Dealer not found: ${dealerNo}` };
  }

  if (!dealer.contact_email) {
    return { success: false, error: `No email for dealer: ${dealerNo}` };
  }

  const variables = {
    first_name: dealer.contact_first_name || 'there',
  };

  const template = loadTemplate('fb_admin_accepted');
  const htmlBody = renderTemplate(template, variables);

  const subject = "Welcome - We're Now Managing Your Facebook Page";

  const result = await sendEmail(dealer.contact_email, subject, htmlBody);

  // Update spreadsheet if email was sent successfully
  if (result.success && updateSpreadsheet) {
    await updateEmailStatus(dealerNo, 'Email Sent');
  }

  return result;
}

/**
 * Send First Post Scheduled Email
 * Trigger: First time posts are scheduled for a FULL dealer
 */
export async function sendFirstPostScheduledEmail(
  dealerNo: string,
  updateSpreadsheet: boolean = true
): Promise<EmailResult> {
  // Check blocklist (test accounts, etc.)
  if (isDealerBlocked(dealerNo)) {
    console.log(`[email] Dealer ${dealerNo} is blocked - skipping email`);
    return { success: false, error: `Dealer ${dealerNo} is blocked from emails`, blocked: true };
  }

  const dealer = getDealer(dealerNo);
  if (!dealer) {
    return { success: false, error: `Dealer not found: ${dealerNo}` };
  }

  if (!dealer.contact_email) {
    return { success: false, error: `No email for dealer: ${dealerNo}` };
  }

  const variables = {
    first_name: dealer.contact_first_name || 'there',
    business_name: dealer.display_name || ''
  };

  const template = loadTemplate('first_post_scheduled');
  const htmlBody = renderTemplate(template, variables);

  const subject = "Your Social Media Posts Are Now Scheduled!";

  const result = await sendEmail(dealer.contact_email, subject, htmlBody);

  // Update spreadsheet if email was sent successfully
  if (result.success && updateSpreadsheet) {
    await updateEmailStatus(dealerNo, 'Email Sent');
  }

  return result;
}

/**
 * Send Post Scheduled Email (ongoing)
 * Trigger: Each time new posts are scheduled for a FULL dealer
 */
export async function sendPostScheduledEmail(
  dealerNo: string,
  updateSpreadsheet: boolean = true
): Promise<EmailResult> {
  // Check blocklist (test accounts, etc.)
  if (isDealerBlocked(dealerNo)) {
    console.log(`[email] Dealer ${dealerNo} is blocked - skipping email`);
    return { success: false, error: `Dealer ${dealerNo} is blocked from emails`, blocked: true };
  }

  const dealer = getDealer(dealerNo);
  if (!dealer) {
    return { success: false, error: `Dealer not found: ${dealerNo}` };
  }

  if (!dealer.contact_email) {
    return { success: false, error: `No email for dealer: ${dealerNo}` };
  }

  const variables = {
    first_name: dealer.contact_first_name || 'there'
  };

  const template = loadTemplate('post_scheduled');
  const htmlBody = renderTemplate(template, variables);

  const subject = "Your Latest Social Media Content Has Been Scheduled";

  const result = await sendEmail(dealer.contact_email, subject, htmlBody);

  // Update spreadsheet if email was sent successfully
  if (result.success && updateSpreadsheet) {
    await updateEmailStatus(dealerNo, 'Email Sent');
  }

  return result;
}

/**
 * Send Content Ready Email to CONTENT dealers
 * Trigger: Monthly content package is ready for download
 */
export async function sendContentReadyEmail(
  dealerNo: string,
  downloadUrl: string
): Promise<EmailResult> {
  // Check blocklist (test accounts, etc.)
  if (isDealerBlocked(dealerNo)) {
    console.log(`[email] Dealer ${dealerNo} is blocked - skipping email`);
    return { success: false, error: `Dealer ${dealerNo} is blocked from emails`, blocked: true };
  }

  const dealer = getDealer(dealerNo);
  if (!dealer) {
    return { success: false, error: `Dealer not found: ${dealerNo}` };
  }

  if (!dealer.contact_email) {
    return { success: false, error: `No email for dealer: ${dealerNo}` };
  }

  const brandInfo = getBrandInfo(dealer);

  const variables = {
    first_name: dealer.contact_first_name || 'there',
    business_name: dealer.display_name || '',
    distributor: dealer.distributor_name || 'your distributor',
    brand: brandInfo.brand,
    video_url: brandInfo.video_url,
    download_url: downloadUrl,
    fb_admin_guide_url: FB_ADMIN_GUIDE_URL
  };

  const template = loadTemplate('content_ready');
  const htmlBody = renderTemplate(template, variables);

  const subject = `${variables.distributor} - ${variables.brand} Dealer Program - Social Media Content is Ready to Download.`;

  return sendEmail(dealer.contact_email, subject, htmlBody);
}

/**
 * Send Onboarding Complete Email to Olivia
 * Trigger: After dealer approval automation completes
 */
export async function sendOnboardingCompleteEmail({
  dealerNo,
  dealerName,
  postsCount,
  estimatedCompletion,
  spreadsheetColumn,
}: {
  dealerNo: string;
  dealerName: string;
  postsCount: number;
  estimatedCompletion: string;
  spreadsheetColumn: string;
}): Promise<EmailResult> {
  const variables = {
    dealer_no: dealerNo,
    dealer_name: dealerName,
    posts_count: String(postsCount),
    estimated_completion: estimatedCompletion,
    drive_folder_url: `https://drive.google.com/drive/folders/1QwyyE9Pq-p8u-TEz7B5nC-14BERpDPmv`,
    spreadsheet_url: `https://docs.google.com/spreadsheets/d/1KuyojiujcaxmyJeBIxExG87W2AwM3LM1awqWO9u44PY/edit#gid=0&range=${spreadsheetColumn}1`,
    spreadsheet_column: spreadsheetColumn,
  };

  const template = loadTemplate('onboarding_complete');
  const htmlBody = renderTemplate(template, variables);

  const subject = `New Dealer Onboarded: ${dealerName} (#${dealerNo})`;

  return sendEmail('oliviab731@gmail.com', subject, htmlBody);
}
