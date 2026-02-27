/**
 * Export pe_prospects and pe_allied_dealers for matching.
 *
 * Reads both collections from the DEFAULT Firestore database (woodhouse_social)
 * and writes lightweight JSON files with only the fields needed for matching.
 *
 * Usage:
 *   cd ~/woodhouse_creative
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/export-for-matching.ts
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync } from 'fs';

const PROSPECTS_OUT = '/tmp/pe-prospects-matching.json';
const ALLIED_OUT = '/tmp/pe-allied-matching.json';

// Initialize Firebase — DEFAULT database (woodhouse_social)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function exportProspects() {
  console.log('[export] Reading pe_prospects...');

  const prospects: Record<string, unknown>[] = [];
  let lastDoc: FirebaseFirestore.DocumentSnapshot | null = null;
  const PAGE_SIZE = 5000;
  let page = 0;

  while (true) {
    let query = db.collection('pe_prospects')
      .select(
        'title', 'city', 'state', 'primary_phone', 'phones',
        'primary_email', 'emails', 'domain', 'website',
        'is_allied', 'allied_dealer_id'
      )
      .limit(PAGE_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const d = doc.data();
      prospects.push({
        id: doc.id,
        title: d.title || null,
        city: d.city || null,
        state: d.state || null,
        primary_phone: d.primary_phone || null,
        phones: d.phones || [],
        primary_email: d.primary_email || null,
        emails: d.emails || [],
        domain: d.domain || null,
        website: d.website || null,
        is_allied: d.is_allied || false,
        allied_dealer_id: d.allied_dealer_id || null,
      });
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    page++;
    console.log(`  Page ${page}: ${prospects.length.toLocaleString()} prospects so far...`);
  }

  console.log(`[export] Total prospects: ${prospects.length.toLocaleString()}`);

  const alreadyLinked = prospects.filter(p => p.is_allied).length;
  console.log(`  Already linked (is_allied=true): ${alreadyLinked.toLocaleString()}`);
  console.log(`  Available for matching: ${(prospects.length - alreadyLinked).toLocaleString()}`);

  writeFileSync(PROSPECTS_OUT, JSON.stringify(prospects));
  const sizeMB = (Buffer.byteLength(JSON.stringify(prospects)) / 1024 / 1024).toFixed(1);
  console.log(`  Written to ${PROSPECTS_OUT} (${sizeMB} MB)`);

  return prospects.length;
}

async function exportAllied() {
  console.log('\n[export] Reading pe_allied_dealers...');

  const dealers: Record<string, unknown>[] = [];
  let lastDoc: FirebaseFirestore.DocumentSnapshot | null = null;
  const PAGE_SIZE = 5000;

  while (true) {
    let query = db.collection('pe_allied_dealers')
      .select(
        'dealer_no', 'dealer_name', 'city', 'state',
        'contact_phone', 'contact_email', 'dealer_website',
        'allied_segment', 'suppress_from_outreach'
      )
      .limit(PAGE_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const d = doc.data();
      dealers.push({
        dealer_no: doc.id,
        dealer_name: d.dealer_name || null,
        city: d.city || null,
        state: d.state || null,
        contact_phone: d.contact_phone || null,
        contact_email: d.contact_email || null,
        dealer_website: d.dealer_website || null,
        allied_segment: d.allied_segment || null,
        suppress_from_outreach: d.suppress_from_outreach || false,
      });
    }

    lastDoc = snap.docs[snap.docs.length - 1];
  }

  console.log(`[export] Total allied dealers: ${dealers.length.toLocaleString()}`);

  // Quick stats
  const withPhone = dealers.filter(d => d.contact_phone).length;
  const withEmail = dealers.filter(d => d.contact_email).length;
  const withWebsite = dealers.filter(d => d.dealer_website).length;
  console.log(`  With phone: ${withPhone.toLocaleString()}`);
  console.log(`  With email: ${withEmail.toLocaleString()}`);
  console.log(`  With website: ${withWebsite.toLocaleString()}`);

  writeFileSync(ALLIED_OUT, JSON.stringify(dealers));
  const sizeMB = (Buffer.byteLength(JSON.stringify(dealers)) / 1024 / 1024).toFixed(1);
  console.log(`  Written to ${ALLIED_OUT} (${sizeMB} MB)`);

  return dealers.length;
}

async function main() {
  console.log('[export] Exporting collections for matching...\n');

  const [prospectCount, alliedCount] = await Promise.all([
    exportProspects(),
    exportAllied(),
  ]);

  console.log(`\n[export] Done.`);
  console.log(`  Prospects: ${prospectCount.toLocaleString()} → ${PROSPECTS_OUT}`);
  console.log(`  Allied:    ${alliedCount.toLocaleString()} → ${ALLIED_OUT}`);
}

main().catch(err => {
  console.error('[export] Fatal error:', err);
  process.exit(1);
});
