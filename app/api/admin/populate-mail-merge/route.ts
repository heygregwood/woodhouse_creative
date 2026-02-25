/**
 * POST /api/admin/populate-mail-merge
 *
 * Populates the Mail Merge spreadsheet with CONTENT/NEW dealers from Firestore.
 * Used for sending welcome emails to content dealers.
 *
 * Spreadsheet: Turnkey SM Content Email
 * Sheet: Mail Merge
 *
 * Columns:
 * A: First Name
 * B: Business Name
 * C: Brand (Armstrong Air® or AirEase™)
 * D: Distributor
 * E: Email Address
 * F: Video Link (Vimeo URL based on brand)
 * G: File Attachments (Google Drive PDF link)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDealers } from '@/lib/firestore-dealers';
import { google } from 'googleapis';

// Spreadsheet configuration
const SPREADSHEET_ID = '1_FCqDNpssdWZ32o6ORSxuZ0BS8RFORh6AWojHxMCfas';
const SHEET_NAME = 'Mail Merge';

// Video links by brand
const VIDEO_LINKS = {
  armstrongAir: 'https://vimeo.com/910160703/51df1eb27d',
  airease: 'https://vimeo.com/914492643',
};

// File attachment (welcome PDF)
const FILE_ATTACHMENT = 'https://drive.google.com/file/d/1MEe7lybJ6oghz5pJOZvUaXdSu4m279CI/view?usp=share_link';

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

interface MailMergeDealer {
  firstName: string;
  businessName: string;
  brand: string;
  distributor: string;
  email: string;
  videoLink: string;
  fileAttachment: string;
}

export async function GET() {
  try {
    // Get all dealers from Firestore
    const allDealers = await getDealers();

    // Filter to CONTENT and NEW dealers only (with valid email)
    const contentDealers = allDealers.filter(
      (d) => (d.program_status === 'CONTENT' || d.program_status === 'NEW') && d.contact_email
    );

    // Format for preview (all dealers - no duplicate checking)
    const preview: MailMergeDealer[] = contentDealers.map((d) => {
      const isArmstrong = d.armstrong_air === 1 || d.armstrong_air === true;
      return {
        firstName: d.contact_first_name || '',
        businessName: d.dealer_name || '',
        brand: isArmstrong ? 'Armstrong Air®' : 'AirEase™',
        distributor: d.distributor_name || '',
        email: d.contact_email || '',
        videoLink: isArmstrong ? VIDEO_LINKS.armstrongAir : VIDEO_LINKS.airease,
        fileAttachment: FILE_ATTACHMENT,
      };
    });

    return NextResponse.json({
      success: true,
      totalContent: contentDealers.length,
      toAdd: contentDealers.length,
      preview: preview.slice(0, 10), // Show first 10 for preview
    });
  } catch (error) {
    console.error('[populate-mail-merge] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch dealers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dryRun = false } = body;

    // Get all dealers from Firestore
    const allDealers = await getDealers();

    // Filter to CONTENT and NEW dealers only (with valid email)
    const contentDealers = allDealers.filter(
      (d) => (d.program_status === 'CONTENT' || d.program_status === 'NEW') && d.contact_email
    );

    if (contentDealers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No CONTENT/NEW dealers with email addresses found',
        added: 0,
      });
    }

    // Format rows for spreadsheet (all dealers - no duplicate checking)
    const rows = contentDealers.map((d) => {
      const isArmstrong = d.armstrong_air === 1 || d.armstrong_air === true;
      return [
        d.contact_first_name || '',
        d.dealer_name || '',
        isArmstrong ? 'Armstrong Air®' : 'AirEase™',
        d.distributor_name || '',
        d.contact_email || '',
        isArmstrong ? VIDEO_LINKS.armstrongAir : VIDEO_LINKS.airease,
        FILE_ATTACHMENT,
      ];
    });

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        wouldAdd: rows.length,
        preview: rows.slice(0, 10),
      });
    }

    const sheets = getSheetsClient();

    // Find next available row
    const allData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:A`,
    });
    const nextRow = (allData.data.values?.length || 1) + 1;

    // Append rows to spreadsheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${nextRow}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: rows,
      },
    });

    console.log(`[populate-mail-merge] Added ${rows.length} dealers starting at row ${nextRow}`);

    return NextResponse.json({
      success: true,
      message: `Added ${rows.length} dealers to Mail Merge spreadsheet`,
      added: rows.length,
      startRow: nextRow,
    });
  } catch (error) {
    console.error('[populate-mail-merge] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to populate mail merge' },
      { status: 500 }
    );
  }
}
