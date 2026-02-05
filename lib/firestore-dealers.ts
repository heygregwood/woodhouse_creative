/**
 * Firestore Dealers Module - Replaces SQLite write operations
 *
 * All dealer CRUD operations for Firestore
 * Collection: "dealers"
 * Document ID: dealer_no (e.g., "10122026")
 */

import { db } from '@/lib/firebase';
import { FieldValue } from 'firebase-admin/firestore';

// Firestore collection name
const DEALERS_COLLECTION = 'dealers';

// Type definition matching SQLite schema
export interface FirestoreDealer {
  dealer_no: string;
  dealer_name: string;
  display_name?: string | null;
  program_status: string;
  source: string;

  // Contact info
  contact_name?: string | null;
  contact_first_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_admin_email?: string | null;

  // Dates
  first_post_date?: string | null;
  date_added?: string | null;
  registration_date?: string | null;
  renew_date?: string | null;

  // Location
  dealer_address?: string | null;
  dealer_city?: string | null;
  dealer_state?: string | null;
  dealer_web_address?: string | null;
  region?: string | null;

  // Distributor
  distributor_name?: string | null;

  // Status
  allied_status?: string | null;

  // Brands
  armstrong_air: number;
  airease: number;
  tier?: string | null;

  // Creatomate validated fields
  creatomate_phone?: string | null;
  creatomate_website?: string | null;
  creatomate_logo?: string | null;

  // Turnkey fields
  turnkey_phone?: string | null;
  turnkey_url?: string | null;
  turnkey_email?: string | null;

  // Flags
  has_sprout_excel: number;
  bad_email: number;
  ready_for_automate?: string | null;
  logo_needs_design?: number | null;
  logo_source?: string | null;
  review_status?: string | null;
  scheduling_cleanup_done?: boolean;

  // Facebook
  facebook_page_id?: string | null;

  // Email tracking
  first_post_email_sent?: string | null;
  last_post_email_sent?: string | null;

  // Notes
  note?: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Get a dealer by dealer_no
 */
export async function getDealer(dealerNo: string): Promise<FirestoreDealer | null> {
  try {
    const docRef = db.collection(DEALERS_COLLECTION).doc(dealerNo);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as FirestoreDealer;
  } catch (error: unknown) {
    console.error(`[firestore-dealers] Error getting dealer ${dealerNo}:`, error);
    throw error;
  }
}

/**
 * Get all dealers matching a filter
 */
export async function getDealers(filter?: {
  program_status?: string;
  review_status?: string;
  ready_for_automate?: string;
  logo_needs_design?: number;
}): Promise<FirestoreDealer[]> {
  try {
    let query = db.collection(DEALERS_COLLECTION).orderBy('dealer_no');

    if (filter?.program_status) {
      query = query.where('program_status', '==', filter.program_status) as any;
    }
    if (filter?.review_status) {
      query = query.where('review_status', '==', filter.review_status) as any;
    }
    if (filter?.ready_for_automate) {
      query = query.where('ready_for_automate', '==', filter.ready_for_automate) as any;
    }
    if (filter?.logo_needs_design !== undefined) {
      query = query.where('logo_needs_design', '==', filter.logo_needs_design) as any;
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => doc.data() as FirestoreDealer);
  } catch (error: unknown) {
    console.error('[firestore-dealers] Error getting dealers:', error);
    throw error;
  }
}

/**
 * Create a new dealer
 */
export async function createDealer(dealer: Omit<FirestoreDealer, 'created_at' | 'updated_at'>): Promise<void> {
  try {
    const now = new Date().toISOString();
    const docRef = db.collection(DEALERS_COLLECTION).doc(dealer.dealer_no);

    await docRef.set({
      ...dealer,
      created_at: now,
      updated_at: now,
    });

    console.log(`[firestore-dealers] Created dealer ${dealer.dealer_no}`);
  } catch (error: unknown) {
    console.error(`[firestore-dealers] Error creating dealer ${dealer.dealer_no}:`, error);
    throw error;
  }
}

/**
 * Update a dealer (partial update)
 */
export async function updateDealer(
  dealerNo: string,
  updates: Partial<Omit<FirestoreDealer, 'dealer_no' | 'created_at'>>
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const docRef = db.collection(DEALERS_COLLECTION).doc(dealerNo);

    await docRef.update({
      ...updates,
      updated_at: now,
    });

    console.log(`[firestore-dealers] Updated dealer ${dealerNo}`);
  } catch (error: unknown) {
    console.error(`[firestore-dealers] Error updating dealer ${dealerNo}:`, error);
    throw error;
  }
}

/**
 * Delete a dealer
 */
export async function deleteDealer(dealerNo: string): Promise<void> {
  try {
    const docRef = db.collection(DEALERS_COLLECTION).doc(dealerNo);
    await docRef.delete();

    console.log(`[firestore-dealers] Deleted dealer ${dealerNo}`);
  } catch (error: unknown) {
    console.error(`[firestore-dealers] Error deleting dealer ${dealerNo}:`, error);
    throw error;
  }
}

/**
 * Update email sent timestamp
 */
export async function updateEmailTimestamp(
  dealerNo: string,
  emailType: 'first_post' | 'post_scheduled'
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const field = emailType === 'first_post' ? 'first_post_email_sent' : 'last_post_email_sent';

    await updateDealer(dealerNo, {
      [field]: now,
    });

    console.log(`[firestore-dealers] Updated ${field} for dealer ${dealerNo}`);
  } catch (error: unknown) {
    console.error(`[firestore-dealers] Error updating email timestamp for ${dealerNo}:`, error);
    throw error;
  }
}

/**
 * Mark dealer as removed (soft delete)
 */
export async function markDealerRemoved(dealerNo: string): Promise<void> {
  try {
    await updateDealer(dealerNo, {
      allied_status: 'REMOVED',
    });

    console.log(`[firestore-dealers] Marked dealer ${dealerNo} as REMOVED`);
  } catch (error: unknown) {
    console.error(`[firestore-dealers] Error marking dealer ${dealerNo} as removed:`, error);
    throw error;
  }
}

/**
 * Mark scheduling spreadsheet cleanup as done for a removed FULL dealer
 */
export async function markSchedulingCleanupDone(dealerNo: string): Promise<void> {
  try {
    await updateDealer(dealerNo, {
      scheduling_cleanup_done: true,
    });
    console.log(`[firestore-dealers] Marked scheduling cleanup done for dealer ${dealerNo}`);
  } catch (error: unknown) {
    console.error(`[firestore-dealers] Error marking cleanup done for ${dealerNo}:`, error);
    throw error;
  }
}

/**
 * Update logo URL
 */
export async function updateLogo(dealerNo: string, logoUrl: string): Promise<void> {
  try {
    await updateDealer(dealerNo, {
      creatomate_logo: logoUrl,
    });

    console.log(`[firestore-dealers] Updated logo for dealer ${dealerNo}`);
  } catch (error: unknown) {
    console.error(`[firestore-dealers] Error updating logo for ${dealerNo}:`, error);
    throw error;
  }
}

/**
 * Mark dealer as needing design
 */
export async function markNeedsDesign(dealerNo: string, needsDesign: boolean): Promise<void> {
  try {
    await updateDealer(dealerNo, {
      logo_needs_design: needsDesign ? 1 : 0,
    });

    console.log(`[firestore-dealers] Marked dealer ${dealerNo} logo_needs_design=${needsDesign ? 1 : 0}`);
  } catch (error: unknown) {
    console.error(`[firestore-dealers] Error marking dealer ${dealerNo} needs design:`, error);
    throw error;
  }
}

/**
 * Promote dealer to FULL (with review_status = pending_review if applicable)
 */
export async function promoteToFull(dealerNo: string, setPendingReview: boolean = false): Promise<void> {
  try {
    const updates: Partial<FirestoreDealer> = {
      program_status: 'FULL',
    };

    if (setPendingReview) {
      updates.review_status = 'pending_review';
    }

    await updateDealer(dealerNo, updates);

    console.log(`[firestore-dealers] Promoted dealer ${dealerNo} to FULL${setPendingReview ? ' (pending review)' : ''}`);
  } catch (error: unknown) {
    console.error(`[firestore-dealers] Error promoting dealer ${dealerNo}:`, error);
    throw error;
  }
}

/**
 * Demote dealer to CONTENT
 */
export async function demoteToContent(dealerNo: string): Promise<void> {
  try {
    await updateDealer(dealerNo, {
      program_status: 'CONTENT',
    });

    console.log(`[firestore-dealers] Demoted dealer ${dealerNo} to CONTENT`);
  } catch (error: unknown) {
    console.error(`[firestore-dealers] Error demoting dealer ${dealerNo}:`, error);
    throw error;
  }
}

/**
 * Approve dealer after review (clear pending_review status, set validated fields)
 */
export async function approveDealer(
  dealerNo: string,
  approvalData: {
    display_name: string;
    creatomate_phone: string;
    creatomate_website: string;
    creatomate_logo: string;
    region?: string | null;
  }
): Promise<void> {
  try {
    await updateDealer(dealerNo, {
      ...approvalData,
      review_status: null,
      ready_for_automate: 'yes',
    });

    console.log(`[firestore-dealers] Approved dealer ${dealerNo}`);
  } catch (error: unknown) {
    console.error(`[firestore-dealers] Error approving dealer ${dealerNo}:`, error);
    throw error;
  }
}

/**
 * Batch create dealers (for migration)
 */
export async function batchCreateDealers(dealers: Omit<FirestoreDealer, 'created_at' | 'updated_at'>[]): Promise<void> {
  try {
    const now = new Date().toISOString();
    const batch = db.batch();

    for (const dealer of dealers) {
      const docRef = db.collection(DEALERS_COLLECTION).doc(dealer.dealer_no);
      batch.set(docRef, {
        ...dealer,
        created_at: now,
        updated_at: now,
      });
    }

    await batch.commit();

    console.log(`[firestore-dealers] Batch created ${dealers.length} dealers`);
  } catch (error: unknown) {
    console.error('[firestore-dealers] Error batch creating dealers:', error);
    throw error;
  }
}
