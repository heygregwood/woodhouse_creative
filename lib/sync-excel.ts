/**
 * TypeScript implementation of Excel sync functionality
 * Replaces Python script sync_from_excel.py
 *
 * Uses Microsoft Graph API to read Excel file directly from SharePoint
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import Database from 'better-sqlite3';
import path from 'path';
import { createDealer, updateDealer, markDealerRemoved, getDealers } from './firestore-dealers';
import type { FirestoreDealer } from './firestore-dealers';

const DB_PATH = path.join(process.cwd(), 'data', 'sqlite', 'creative.db');

// Microsoft Azure credentials
const TENANT_ID = process.env.MICROSOFT_TENANT_ID || '';
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || '';

// SharePoint file location
// URL: https://woodhouseagency-my.sharepoint.com/:x:/p/greg/IQBRuqg2XiXNTIVnn6BLkArzAXUD3DR-8K3nxhQADxWtoP4
// This is a personal OneDrive URL (woodhouseagency-my.sharepoint.com)
const SITE_HOST = 'woodhouseagency-my.sharepoint.com';
const DRIVE_OWNER_EMAIL = process.env.SHAREPOINT_OWNER_EMAIL || 'greg@woodhouseagency.com';
const FILE_PATH = process.env.SHAREPOINT_FILE_PATH || '/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database/Turnkey Social Media - Dealers - Current.xlsm';
const SHEET_NAME = 'Woodhouse Data';

interface ExcelRow {
  dealer_no: string;
  dealer_name: string;
  program_status: string;
  source: string;
  first_post_date?: string;
  date_added?: string;
  distributor_name?: string;
  allied_status?: string;
  armstrong_air: number;
  airease: number;
  tier?: string;
  turnkey_phone?: string;
  turnkey_url?: string;
  turnkey_email?: string;
  contact_name?: string;
  contact_first_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_admin_email?: string;
  dealer_address?: string;
  dealer_city?: string;
  dealer_state?: string;
  dealer_web_address?: string;
  registration_date?: string;
  renew_date?: string;
  note?: string;
  has_sprout_excel: number;
  bad_email: number;
}

interface FieldChange {
  field: string;
  old: string | null;
  new: string | null;
}

export interface DealerChange {
  dealer_no: string;
  dealer_name: string;
  program_status: string;
  changes?: FieldChange[];
  data?: ExcelRow;
}

export interface SyncChanges {
  new: DealerChange[];
  removed: DealerChange[];
  updated: DealerChange[];
  unchanged: string[];
}

// Column mapping: Excel column index -> field name
const COLUMN_INDICES = {
  dealer_no: 0,        // A: Dealer No
  dealer_name: 1,      // B: Dealer Name
  program_status: 2,   // C: Program Status
  source: 3,           // D: Source
  first_post_date: 4,  // E: First Post Date
  date_added: 5,       // F: Date Added
  distributor_name: 6, // G: Distributor Branch Name
  allied_status: 7,    // H: Status
  armstrong_air: 8,    // I: Armstrong Air
  airease: 9,          // J: AirEase
  tier: 10,            // K: Tier
  turnkey_phone: 11,   // L: TurnkeyPhone
  turnkey_url: 12,     // M: TurnkeyURL
  turnkey_email: 13,   // N: TurnkeyEmail
  contact_name: 14,    // O: Contact Name
  contact_first_name: 15, // P: Contact First Name
  contact_email: 16,   // Q: Contact Email Address
  contact_phone: 17,   // R: Contact Phone
  contact_admin_email: 18, // S: Contact Admin Email Address
  dealer_address: 19,  // T: Dealer Address
  dealer_city: 20,     // U: Dealer City
  dealer_state: 21,    // V: Dealer State
  dealer_web_address: 22, // W: Dealer Web Address
  registration_date: 23, // X: Registration Date
  renew_date: 24,      // Y: Renew Date
  note: 25,            // Z: NOTE
  has_sprout_excel: 26, // AA: Sprout
  bad_email: 27,       // AB: Bad Email
};

// Fields to track for changes
const TRACKED_FIELDS = [
  'program_status',
  'dealer_name',
  'contact_name',
  'contact_email',
  'turnkey_phone',
  'dealer_web_address',
  'allied_status',
];

function getMicrosoftGraphClient(): Client {
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing Microsoft Azure credentials. Set MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, and MICROSOFT_CLIENT_SECRET environment variables.');
  }

  // Create Azure AD credential using client secret
  const credential = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);

  // Create Graph client with token credential authentication
  const client = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const token = await credential.getToken(['https://graph.microsoft.com/.default']);
        return token?.token || '';
      },
    },
  });

  return client;
}

function parseExcelRow(row: any[]): ExcelRow | null {
  // Parse dealer number
  let dealerNo = row[COLUMN_INDICES.dealer_no];
  if (!dealerNo) return null;

  // Clean dealer number (handle floats from Excel)
  if (typeof dealerNo === 'number') {
    dealerNo = Math.floor(dealerNo).toString();
  } else {
    dealerNo = dealerNo.toString().trim();
  }

  // Parse program status - normalize to FULL or CONTENT only
  const rawStatus = row[COLUMN_INDICES.program_status]?.toString().trim().toUpperCase() || '';
  let programStatus: string;
  if (rawStatus === 'FULL') {
    programStatus = 'FULL';
  } else {
    // Everything else (NEW, CONTENT, REMOVED, empty, etc.) becomes CONTENT
    programStatus = 'CONTENT';
  }

  // Parse boolean fields
  const parseBool = (val: any): number => {
    if (val === true || val === 'TRUE' || val === 'YES' || val === 1) return 1;
    return 0;
  };

  return {
    dealer_no: dealerNo,
    dealer_name: row[COLUMN_INDICES.dealer_name]?.toString().trim() || '',
    program_status: programStatus,
    source: row[COLUMN_INDICES.source]?.toString().trim() || 'Allied Dealer Program',
    first_post_date: row[COLUMN_INDICES.first_post_date]?.toString().trim() || undefined,
    date_added: row[COLUMN_INDICES.date_added]?.toString().trim() || undefined,
    distributor_name: row[COLUMN_INDICES.distributor_name]?.toString().trim() || undefined,
    allied_status: row[COLUMN_INDICES.allied_status]?.toString().trim() || undefined,
    armstrong_air: parseBool(row[COLUMN_INDICES.armstrong_air]),
    airease: parseBool(row[COLUMN_INDICES.airease]),
    tier: row[COLUMN_INDICES.tier]?.toString().trim() || undefined,
    turnkey_phone: row[COLUMN_INDICES.turnkey_phone]?.toString().trim() || undefined,
    turnkey_url: row[COLUMN_INDICES.turnkey_url]?.toString().trim() || undefined,
    turnkey_email: row[COLUMN_INDICES.turnkey_email]?.toString().trim() || undefined,
    contact_name: row[COLUMN_INDICES.contact_name]?.toString().trim() || undefined,
    contact_first_name: row[COLUMN_INDICES.contact_first_name]?.toString().trim() || undefined,
    contact_email: row[COLUMN_INDICES.contact_email]?.toString().trim() || undefined,
    contact_phone: row[COLUMN_INDICES.contact_phone]?.toString().trim() || undefined,
    contact_admin_email: row[COLUMN_INDICES.contact_admin_email]?.toString().trim() || undefined,
    dealer_address: row[COLUMN_INDICES.dealer_address]?.toString().trim() || undefined,
    dealer_city: row[COLUMN_INDICES.dealer_city]?.toString().trim() || undefined,
    dealer_state: row[COLUMN_INDICES.dealer_state]?.toString().trim() || undefined,
    dealer_web_address: row[COLUMN_INDICES.dealer_web_address]?.toString().trim() || undefined,
    registration_date: row[COLUMN_INDICES.registration_date]?.toString().trim() || undefined,
    renew_date: row[COLUMN_INDICES.renew_date]?.toString().trim() || undefined,
    note: row[COLUMN_INDICES.note]?.toString().trim() || undefined,
    has_sprout_excel: parseBool(row[COLUMN_INDICES.has_sprout_excel]),
    bad_email: parseBool(row[COLUMN_INDICES.bad_email]),
  };
}

export async function readExcelData(): Promise<Map<string, ExcelRow>> {
  const client = getMicrosoftGraphClient();

  try {
    // Get the user's drive ID first
    const userResponse = await client
      .api(`/users/${DRIVE_OWNER_EMAIL}/drive`)
      .get();

    const driveId = userResponse.id;

    // Get the file by path
    const fileResponse = await client
      .api(`/drives/${driveId}/root:${FILE_PATH}`)
      .get();

    const fileId = fileResponse.id;

    // Download the file content as a buffer
    // Note: We use /content endpoint instead of /workbook because Excel API
    // doesn't support application permissions (requires delegated/user permissions)
    const fileBuffer = await client
      .api(`/drives/${driveId}/items/${fileId}/content`)
      .getStream();

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of fileBuffer) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    // Parse Excel file using xlsx library
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // Find the worksheet
    if (!workbook.SheetNames.includes(SHEET_NAME)) {
      throw new Error(`Worksheet "${SHEET_NAME}" not found in Excel file. Available sheets: ${workbook.SheetNames.join(', ')}`);
    }

    const worksheet = workbook.Sheets[SHEET_NAME];

    // Convert worksheet to array of arrays
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];

    if (rows.length < 2) {
      throw new Error('Excel file is empty or has no data rows');
    }

    const dealers = new Map<string, ExcelRow>();

    // Skip header row (index 0)
    for (let i = 1; i < rows.length; i++) {
      const dealer = parseExcelRow(rows[i]);
      if (dealer && dealer.dealer_no) {
        dealers.set(dealer.dealer_no, dealer);
      }
    }

    return dealers;
  } catch (error) {
    console.error('Excel sync error details:', error);
    if (error instanceof Error) {
      // Try to extract more details from Graph API errors
      const errorBody = (error as any).body;
      if (errorBody) {
        try {
          const parsed = JSON.parse(errorBody);
          throw new Error(`Failed to read Excel from SharePoint: ${error.message} - ${JSON.stringify(parsed)}`);
        } catch {
          throw new Error(`Failed to read Excel from SharePoint: ${error.message} - ${errorBody}`);
        }
      }
      throw new Error(`Failed to read Excel from SharePoint: ${error.message}`);
    }
    throw new Error('Failed to read Excel from SharePoint: Unknown error');
  }
}

export async function readDatabaseDealers(): Promise<Map<string, any>> {
  const dealers = new Map<string, any>();

  const firestoreDealers = await getDealers();
  for (const dealer of firestoreDealers) {
    dealers.set(dealer.dealer_no, dealer);
  }

  return dealers;
}

export function compareDealers(excelDealers: Map<string, ExcelRow>, dbDealers: Map<string, any>): SyncChanges {
  const changes: SyncChanges = {
    new: [],
    removed: [],
    updated: [],
    unchanged: [],
  };

  const excelDealerNos = new Set(excelDealers.keys());
  const dbDealerNos = new Set(dbDealers.keys());

  // Find new dealers
  for (const dealerNo of excelDealerNos) {
    if (!dbDealerNos.has(dealerNo)) {
      const dealer = excelDealers.get(dealerNo)!;
      changes.new.push({
        dealer_no: dealerNo,
        dealer_name: dealer.dealer_name,
        program_status: dealer.program_status,
        data: dealer,
      });
    }
  }

  // Find removed dealers (Allied only)
  for (const dealerNo of dbDealerNos) {
    if (!excelDealerNos.has(dealerNo)) {
      const dealer = dbDealers.get(dealerNo)!;
      if (dealer.source === 'Allied Dealer Program') {
        changes.removed.push({
          dealer_no: dealerNo,
          dealer_name: dealer.dealer_name,
          program_status: dealer.program_status,
        });
      }
    }
  }

  // Find updated dealers
  for (const dealerNo of excelDealerNos) {
    if (dbDealerNos.has(dealerNo)) {
      const excelDealer = excelDealers.get(dealerNo)!;
      const dbDealer = dbDealers.get(dealerNo)!;

      const fieldChanges: FieldChange[] = [];

      for (const field of TRACKED_FIELDS) {
        const excelVal = (excelDealer as any)[field] ? String((excelDealer as any)[field]).trim() : null;
        const dbVal = dbDealer[field] ? String(dbDealer[field]).trim() : null;

        if (excelVal !== dbVal) {
          fieldChanges.push({
            field,
            old: dbVal,
            new: excelVal,
          });
        }
      }

      if (fieldChanges.length > 0) {
        changes.updated.push({
          dealer_no: dealerNo,
          dealer_name: excelDealer.dealer_name,
          program_status: excelDealer.program_status,
          changes: fieldChanges,
          data: excelDealer,
        });
      } else {
        changes.unchanged.push(dealerNo);
      }
    }
  }

  return changes;
}

export async function applyChanges(changes: SyncChanges): Promise<void> {
  try {
    // Insert new dealers into Firestore
    for (const dealer of changes.new) {
      const data = dealer.data!;

      const newDealer: Omit<FirestoreDealer, 'created_at' | 'updated_at'> = {
        dealer_no: data.dealer_no,
        dealer_name: data.dealer_name,
        display_name: null,
        program_status: data.program_status,
        source: data.source,
        contact_name: data.contact_name || null,
        contact_first_name: data.contact_first_name || null,
        contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null,
        contact_admin_email: data.contact_admin_email || null,
        first_post_date: data.first_post_date || null,
        date_added: data.date_added || null,
        registration_date: data.registration_date || null,
        renew_date: data.renew_date || null,
        dealer_address: data.dealer_address || null,
        dealer_city: data.dealer_city || null,
        dealer_state: data.dealer_state || null,
        dealer_web_address: data.dealer_web_address || null,
        region: null,
        distributor_name: data.distributor_name || null,
        allied_status: data.allied_status || null,
        armstrong_air: data.armstrong_air,
        airease: data.airease,
        tier: data.tier || null,
        creatomate_phone: null,
        creatomate_website: null,
        creatomate_logo: null,
        turnkey_phone: data.turnkey_phone || null,
        turnkey_url: data.turnkey_url || null,
        turnkey_email: data.turnkey_email || null,
        has_sprout_excel: data.has_sprout_excel,
        bad_email: data.bad_email,
        ready_for_automate: null,
        logo_needs_design: null,
        review_status: null,
        facebook_page_id: null,
        first_post_email_sent: null,
        last_post_email_sent: null,
        note: data.note || null,
      };

      await createDealer(newDealer);
    }

    // Update existing dealers in Firestore
    for (const dealer of changes.updated) {
      const data = dealer.data!;

      // Check if promoted to FULL
      const isPromotionToFull = dealer.changes?.some(
        (c) => c.field === 'program_status' && c.new === 'FULL' && (c.old === 'CONTENT' || c.old === 'NEW' || !c.old)
      );

      const updates: Partial<Omit<FirestoreDealer, 'dealer_no' | 'created_at' | 'updated_at'>> = {
        dealer_name: data.dealer_name,
        program_status: data.program_status,
        source: data.source,
        first_post_date: data.first_post_date || null,
        date_added: data.date_added || null,
        distributor_name: data.distributor_name || null,
        allied_status: data.allied_status || null,
        armstrong_air: data.armstrong_air,
        airease: data.airease,
        tier: data.tier || null,
        turnkey_phone: data.turnkey_phone || null,
        turnkey_url: data.turnkey_url || null,
        turnkey_email: data.turnkey_email || null,
        contact_name: data.contact_name || null,
        contact_first_name: data.contact_first_name || null,
        contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null,
        contact_admin_email: data.contact_admin_email || null,
        dealer_address: data.dealer_address || null,
        dealer_city: data.dealer_city || null,
        dealer_state: data.dealer_state || null,
        dealer_web_address: data.dealer_web_address || null,
        registration_date: data.registration_date || null,
        renew_date: data.renew_date || null,
        note: data.note || null,
        has_sprout_excel: data.has_sprout_excel,
        bad_email: data.bad_email,
        review_status: isPromotionToFull ? 'pending_review' : null,
      };

      await updateDealer(dealer.dealer_no, updates);
    }

    // Mark removed dealers in Firestore
    for (const dealer of changes.removed) {
      await markDealerRemoved(dealer.dealer_no);
    }
  } catch (error) {
    throw error;
  }
}

export async function syncFromExcel(apply: boolean = false): Promise<{ changes: SyncChanges; applied: boolean }> {
  const excelDealers = await readExcelData();
  const dbDealers = await readDatabaseDealers();
  const changes = compareDealers(excelDealers, dbDealers);

  if (apply) {
    await applyChanges(changes);
  }

  return { changes, applied: apply };
}
