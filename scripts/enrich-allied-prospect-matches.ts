/**
 * Bidirectional enrichment for Allied ↔ Prospect matched records.
 *
 * For all pe_prospects with is_allied=true and allied_dealer_id set:
 *
 * 1. pe_allied_dealers gets: prospect_contacts (emails, phones, domain, website)
 *    from the matched pe_prospect — richer contact data for Allied-specific outreach.
 *
 * 2. pe_prospects gets: Allied API contacts (contact_email, contact_phone) added
 *    to emails[] and phones[] arrays — more contact options for campaigns.
 *
 * 3. current_turnkey prospects get suppression flags:
 *    - outreach_status = 'allied_dealer'
 *    - email_opted_out = true
 *    - email_opted_out_reason = 'allied_dealer'
 *
 * Usage:
 *   cd ~/woodhouse_creative
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/enrich-allied-prospect-matches.ts --dry-run
 *   npx tsx scripts/enrich-allied-prospect-matches.ts --write
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const BATCH_SIZE = 400;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const writeMode = args.includes('--write');

if (!dryRun && !writeMode) {
  console.error('[enrich] ERROR: Must specify --dry-run or --write');
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore(); // Default db = woodhouse_social

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  const clean = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return clean.length === 10 ? clean : null;
}

interface ProspectUpdate {
  ref: FirebaseFirestore.DocumentReference;
  prospectTitle: string;
  addEmails: string[];
  addPhones: string[];
  suppress: boolean;
  dealerNo: string;
  segment: string;
}

interface AlliedUpdate {
  ref: FirebaseFirestore.DocumentReference;
  dealerName: string;
  prospectContacts: {
    emails: string[];
    phones: string[];
    domain: string | null;
    website: string | null;
    matched_prospect_id: string;
    matched_prospect_title: string;
  };
}

async function main() {
  console.log('[enrich] Step 1: Reading all matched pe_prospects (is_allied=true)...');

  const prospectSnap = await db.collection('pe_prospects')
    .where('is_allied', '==', true)
    .get();

  console.log(`  Found ${prospectSnap.size.toLocaleString()} Allied prospects`);

  // Group by allied_dealer_id for looking up pe_allied_dealers
  const dealerIds = new Set<string>();
  const prospectsByDealer = new Map<string, FirebaseFirestore.DocumentSnapshot[]>();

  for (const doc of prospectSnap.docs) {
    const dealerId = doc.data().allied_dealer_id as string | null;
    if (!dealerId) continue;
    dealerIds.add(dealerId);
    const existing = prospectsByDealer.get(dealerId) || [];
    existing.push(doc);
    prospectsByDealer.set(dealerId, existing);
  }

  console.log(`  Unique allied_dealer_ids: ${dealerIds.size.toLocaleString()}`);

  // Step 2: Read matching pe_allied_dealers
  console.log('\n[enrich] Step 2: Reading matched pe_allied_dealers...');

  const alliedData = new Map<string, FirebaseFirestore.DocumentData>();
  const dealerIdArray = Array.from(dealerIds);

  // Firestore 'in' queries limited to 30 items
  for (let i = 0; i < dealerIdArray.length; i += 30) {
    const chunk = dealerIdArray.slice(i, i + 30);
    const snap = await db.collection('pe_allied_dealers')
      .where('dealer_no', 'in', chunk)
      .get();
    for (const doc of snap.docs) {
      alliedData.set(doc.id, doc.data());
    }

    if ((i / 30) % 50 === 0 && i > 0) {
      console.log(`  Read ${Math.min(i + 30, dealerIdArray.length).toLocaleString()}/${dealerIdArray.length.toLocaleString()} dealers...`);
    }
  }

  console.log(`  Loaded ${alliedData.size.toLocaleString()} Allied dealer records`);

  // Step 3: Build update lists
  console.log('\n[enrich] Step 3: Building enrichment updates...');

  const prospectUpdates: ProspectUpdate[] = [];
  const alliedUpdates: AlliedUpdate[] = [];
  let suppressCount = 0;
  let prospectEmailsAdded = 0;
  let prospectPhonesAdded = 0;
  let alliedEnriched = 0;
  let noAlliedRecord = 0;

  for (const [dealerNo, prospectDocs] of prospectsByDealer.entries()) {
    const allied = alliedData.get(dealerNo);
    if (!allied) {
      noAlliedRecord++;
      continue;
    }

    const segment = (allied.allied_segment as string) || '';
    const isCurrentTurnkey = allied.is_current_turnkey === true;
    const alliedEmail = ((allied.contact_email as string) || '').trim().toLowerCase();
    const alliedPhone = normalizePhone(allied.contact_phone as string);

    // Process each matched prospect
    for (const pDoc of prospectDocs) {
      const pData = pDoc.data();
      const pTitle = (pData.title as string) || '';
      const existingEmails = new Set(
        ((pData.emails as string[]) || []).map((e: string) => e.trim().toLowerCase())
      );
      const existingPhones = new Set(
        ((pData.phones as string[]) || []).map((p: string) => normalizePhone(p)).filter(Boolean)
      );

      // What Allied contacts can we add to the prospect?
      const addEmails: string[] = [];
      const addPhones: string[] = [];

      if (alliedEmail && !existingEmails.has(alliedEmail)) {
        addEmails.push(alliedEmail);
        prospectEmailsAdded++;
      }

      if (alliedPhone && !existingPhones.has(alliedPhone)) {
        // Store formatted for consistency with existing data
        const formatted = `${alliedPhone.slice(0, 3)}-${alliedPhone.slice(3, 6)}-${alliedPhone.slice(6)}`;
        addPhones.push(formatted);
        prospectPhonesAdded++;
      }

      const suppress = isCurrentTurnkey;
      if (suppress) suppressCount++;

      if (addEmails.length > 0 || addPhones.length > 0 || suppress) {
        prospectUpdates.push({
          ref: pDoc.ref,
          prospectTitle: pTitle,
          addEmails,
          addPhones,
          suppress,
          dealerNo,
          segment,
        });
      }

      // Build prospect_contacts for the Allied dealer record
      const pEmails = (pData.emails as string[]) || [];
      const pPhones = (pData.phones as string[]) || [];
      const pDomain = (pData.domain as string) || null;
      const pWebsite = (pData.website as string) || null;

      if (pEmails.length > 0 || pPhones.length > 0 || pDomain || pWebsite) {
        alliedUpdates.push({
          ref: db.collection('pe_allied_dealers').doc(dealerNo),
          dealerName: (allied.dealer_name as string) || '',
          prospectContacts: {
            emails: pEmails,
            phones: pPhones,
            domain: pDomain,
            website: pWebsite,
            matched_prospect_id: pDoc.id,
            matched_prospect_title: pTitle,
          },
        });
        alliedEnriched++;
      }
    }
  }

  // Deduplicate Allied updates (multiple prospects may map to same dealer)
  const alliedDedup = new Map<string, AlliedUpdate>();
  for (const u of alliedUpdates) {
    const existing = alliedDedup.get(u.ref.id);
    if (!existing) {
      alliedDedup.set(u.ref.id, u);
    }
    // First match wins — don't merge multiple prospect contacts
  }

  console.log(`\n  Enrichment summary:`);
  console.log(`    pe_prospects to update:     ${prospectUpdates.length.toLocaleString()}`);
  console.log(`      Emails to add:            ${prospectEmailsAdded.toLocaleString()}`);
  console.log(`      Phones to add:            ${prospectPhonesAdded.toLocaleString()}`);
  console.log(`      Suppress (current_turnkey): ${suppressCount.toLocaleString()}`);
  console.log(`    pe_allied_dealers to enrich: ${alliedDedup.size.toLocaleString()}`);
  console.log(`    No Allied record found:      ${noAlliedRecord.toLocaleString()}`);

  // Show samples
  console.log('\n  Sample prospect updates:');
  for (const u of prospectUpdates.filter(u => u.addEmails.length > 0 || u.addPhones.length > 0).slice(0, 3)) {
    console.log(`    ${u.dealerNo} "${u.prospectTitle}" [${u.segment}]`);
    if (u.addEmails.length) console.log(`      +emails: ${u.addEmails.join(', ')}`);
    if (u.addPhones.length) console.log(`      +phones: ${u.addPhones.join(', ')}`);
    if (u.suppress) console.log(`      SUPPRESS`);
  }

  console.log('\n  Sample suppress updates:');
  for (const u of prospectUpdates.filter(u => u.suppress).slice(0, 3)) {
    console.log(`    ${u.dealerNo} "${u.prospectTitle}" → outreach_status=allied_dealer, email_opted_out=true`);
  }

  console.log('\n  Sample Allied enrichments:');
  for (const [, u] of Array.from(alliedDedup.entries()).slice(0, 3)) {
    const pc = u.prospectContacts;
    console.log(`    ${u.ref.id} "${u.dealerName}" ← prospect "${pc.matched_prospect_title}"`);
    console.log(`      emails: ${pc.emails.length}, phones: ${pc.phones.length}, domain: ${pc.domain || 'none'}`);
  }

  if (dryRun) {
    console.log('\n[enrich] DRY RUN — no changes made');
    return;
  }

  // Step 4: Write updates
  console.log('\n[enrich] Step 4: Writing prospect updates...');

  let pWritten = 0;
  for (let i = 0; i < prospectUpdates.length; i += BATCH_SIZE) {
    const chunk = prospectUpdates.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const u of chunk) {
      const updates: Record<string, unknown> = {
        updated_at: FieldValue.serverTimestamp(),
      };

      if (u.addEmails.length > 0) {
        updates.emails = FieldValue.arrayUnion(...u.addEmails);
      }
      if (u.addPhones.length > 0) {
        updates.phones = FieldValue.arrayUnion(...u.addPhones);
      }
      if (u.suppress) {
        updates.outreach_status = 'allied_dealer';
        updates.email_opted_out = true;
        updates.email_opted_out_at = FieldValue.serverTimestamp();
        updates.email_opted_out_reason = 'allied_dealer';
      }

      batch.update(u.ref, updates);
    }

    await batch.commit();
    pWritten += chunk.length;
    if ((i / BATCH_SIZE) % 5 === 0 || i + BATCH_SIZE >= prospectUpdates.length) {
      console.log(`  Prospects: ${pWritten.toLocaleString()}/${prospectUpdates.length.toLocaleString()}`);
    }
  }

  console.log('\n[enrich] Step 5: Writing Allied enrichments...');

  let aWritten = 0;
  const alliedChunks = Array.from(alliedDedup.values());
  for (let i = 0; i < alliedChunks.length; i += BATCH_SIZE) {
    const chunk = alliedChunks.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const u of chunk) {
      batch.update(u.ref, {
        prospect_contacts: u.prospectContacts,
        matched_prospect_id: u.prospectContacts.matched_prospect_id,
        updated_at: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    aWritten += chunk.length;
    if ((i / BATCH_SIZE) % 5 === 0 || i + BATCH_SIZE >= alliedChunks.length) {
      console.log(`  Allied: ${aWritten.toLocaleString()}/${alliedChunks.length.toLocaleString()}`);
    }
  }

  console.log(`\n[enrich] Done.`);
  console.log(`  Prospects updated: ${pWritten.toLocaleString()}`);
  console.log(`  Allied enriched: ${aWritten.toLocaleString()}`);

  // Verification
  const suppressedSnap = await db.collection('pe_prospects')
    .where('outreach_status', '==', 'allied_dealer')
    .count()
    .get();
  console.log(`  Prospects with outreach_status='allied_dealer': ${suppressedSnap.data().count.toLocaleString()}`);
}

main().catch(err => {
  console.error('[enrich] Fatal error:', err);
  process.exit(1);
});
