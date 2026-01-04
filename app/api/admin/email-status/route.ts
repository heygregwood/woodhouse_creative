/**
 * GET /api/admin/email-status - Get email delivery status for dealers
 *
 * Query params:
 * - emails: Comma-separated list of email addresses to look up
 *
 * Returns status for each email (delivered, opened, clicked, bounced, complained)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin
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

interface EmailStatus {
  email: string;
  latest_event: string | null;
  latest_event_at: string | null;
  events: {
    sent?: string;
    delivered?: string;
    opened?: string;
    clicked?: string;
    bounced?: string;
    complained?: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const emailsParam = searchParams.get('emails');

    if (!emailsParam) {
      return NextResponse.json({ error: 'Missing emails parameter' }, { status: 400 });
    }

    const emails = emailsParam.split(',').map((e) => e.trim().toLowerCase());

    // Query Firestore for status of each email
    const statusMap: Record<string, EmailStatus> = {};

    // Initialize all emails with null status
    for (const email of emails) {
      statusMap[email] = {
        email,
        latest_event: null,
        latest_event_at: null,
        events: {},
      };
    }

    // Query email_status collection for the latest status per recipient
    // We need to query by recipient_email field
    // Note: Removed orderBy to avoid needing a composite index
    const statusSnapshot = await db
      .collection('email_status')
      .where('recipient_email', 'in', emails.slice(0, 10)) // Firestore 'in' limit is 10
      .get();

    for (const doc of statusSnapshot.docs) {
      const data = doc.data();
      const email = data.recipient_email?.toLowerCase();
      if (email && statusMap[email]) {
        // Only update if this is more recent or first entry
        if (!statusMap[email].latest_event_at ||
            data.updated_at?.toDate() > new Date(statusMap[email].latest_event_at!)) {
          statusMap[email] = {
            email,
            latest_event: data.latest_event?.replace('email.', '') || null,
            latest_event_at: data.latest_event_at?.toDate()?.toISOString() || null,
            events: Object.fromEntries(
              Object.entries(data.events || {}).map(([k, v]) => [
                k,
                (v as FirebaseFirestore.Timestamp)?.toDate?.()?.toISOString() || null,
              ])
            ),
          };
        }
      }
    }

    // If we have more than 10 emails, batch the remaining queries
    if (emails.length > 10) {
      for (let i = 10; i < emails.length; i += 10) {
        const batch = emails.slice(i, i + 10);
        const batchSnapshot = await db
          .collection('email_status')
          .where('recipient_email', 'in', batch)
          .get();

        for (const doc of batchSnapshot.docs) {
          const data = doc.data();
          const email = data.recipient_email?.toLowerCase();
          if (email && statusMap[email]) {
            if (!statusMap[email].latest_event_at ||
                data.updated_at?.toDate() > new Date(statusMap[email].latest_event_at!)) {
              statusMap[email] = {
                email,
                latest_event: data.latest_event?.replace('email.', '') || null,
                latest_event_at: data.latest_event_at?.toDate()?.toISOString() || null,
                events: Object.fromEntries(
                  Object.entries(data.events || {}).map(([k, v]) => [
                    k,
                    (v as FirebaseFirestore.Timestamp)?.toDate?.()?.toISOString() || null,
                  ])
                ),
              };
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      statuses: Object.values(statusMap),
    });
  } catch (error) {
    console.error('Email status lookup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status lookup failed' },
      { status: 500 }
    );
  }
}
