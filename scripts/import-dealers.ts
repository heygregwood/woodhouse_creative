// scripts/import-dealers.ts
// Script to import dealers from CSV to Firestore

import { db } from '../lib/firebase';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Convert Google Drive share link to direct image URL
 * From: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * To: https://drive.google.com/uc?export=view&id=FILE_ID
 */
function convertDriveShareLink(shareUrl: string): string {
  try {
    // Extract file ID from share link
    const match = shareUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const fileId = match[1];
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
    return shareUrl; // Return original if can't parse
  } catch (error) {
    console.error('Error converting Drive link:', error);
    return shareUrl;
  }
}

/**
 * Clean phone number (remove dashes, spaces, parentheses)
 * Keep format for display: (555) 123-4567 or 555-123-4567
 */
function cleanPhone(phone: string): string {
  return phone.trim();
}

/**
 * Clean website URL (remove https://, www., trailing slashes)
 * Keep simple domain for display: example.com
 */
function cleanWebsite(website: string): string {
  return website
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .trim();
}

/**
 * Dealer data from CSV
 */
interface DealerCSVData {
  contactFirstName: string;
  publicCompanyPhone: string;
  publicCompanyName: string;
  publicWebAddress: string;
  logoShareUrl: string;
  dealerNo?: string;
  contactEmail?: string;
}

/**
 * Import a single dealer to Firestore
 */
export async function importDealer(data: DealerCSVData): Promise<string> {
  try {
    // Convert Google Drive share link to direct image URL
    const logoUrl = convertDriveShareLink(data.logoShareUrl);

    // Create business document
    const businessRef = db.collection('businesses').doc();

    await businessRef.set({
      // Business info
      businessName: data.publicCompanyName,
      phone: cleanPhone(data.publicCompanyPhone),
      website: cleanWebsite(data.publicWebAddress),
      logoUrl: logoUrl,

      // Contact info
      contactName: data.contactFirstName,
      email: data.contactEmail || null,

      // Meta
      dealerNo: data.dealerNo || null,

      // Status
      status: 'ACTIVE',

      // Timestamps
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),

      // Note: These fields exist for customer SaaS but not needed for creative automation
      facebookPageId: null,
      facebookPageAccessToken: null,
      stripeCustomerId: null,
      subscriptionStatus: null,
      billingPeriod: null,
      trialEndsAt: null,
      contentStatus: null,
      contentReadyAt: null,
    });

    console.log(`✅ Imported: ${data.publicCompanyName} (${businessRef.id})`);
    return businessRef.id;
  } catch (error) {
    console.error(`❌ Failed to import ${data.publicCompanyName}:`, error);
    throw error;
  }
}

/**
 * Import multiple dealers
 */
export async function importDealers(dealers: DealerCSVData[]): Promise<void> {
  console.log(`Starting import of ${dealers.length} dealers...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const dealer of dealers) {
    try {
      await importDealer(dealer);
      successCount++;
    } catch (error) {
      failCount++;
    }
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
}

// Example usage - you can run this script with your CSV data
// This is just for reference - we'll create an API endpoint to do this
export const SAMPLE_DEALERS: DealerCSVData[] = [
  {
    contactFirstName: "Chris",
    publicCompanyPhone: "269-966-9595",
    publicCompanyName: "Advantage Heating and Cooling",
    publicWebAddress: "hotairnow.com",
    logoShareUrl: "https://drive.google.com/file/d/1SX1DtPMmtVa47bn5w7yitJwBMoYzas3I/view?usp=sharing",
    dealerNo: "10043082",
    contactEmail: "chris@coolairnow.com",
  },
  {
    contactFirstName: "Will",
    publicCompanyPhone: "484-593-7664",
    publicCompanyName: "Paramount Plumbing, Heating and Air Conditioning",
    publicWebAddress: "paramountplumbinghvac.com",
    logoShareUrl: "https://drive.google.com/file/d/1-6Ofzu92zW54msUrxp1hmCo2s0wymjLR/view?usp=sharing",
    dealerNo: "10047081",
    contactEmail: "will@paramountplumbinghvac.com",
  },
  // Add remaining 26 dealers here...
];
