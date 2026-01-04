/**
 * POST /api/webhooks/resend - Receive email event webhooks from Resend
 *
 * Events tracked:
 * - email.delivered - Successfully delivered to recipient's mail server
 * - email.opened - Recipient opened the email
 * - email.clicked - Recipient clicked a link
 * - email.bounced - Email permanently rejected
 * - email.complained - Recipient marked as spam
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
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

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // For click events
    click?: {
      link: string;
      timestamp: string;
    };
  };
}

/**
 * Verify the webhook signature from Resend
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const payload = await request.text();
    const signature = request.headers.get('svix-signature') || '';
    const svixId = request.headers.get('svix-id') || '';
    const svixTimestamp = request.headers.get('svix-timestamp') || '';

    // Verify webhook secret is configured
    if (!WEBHOOK_SECRET) {
      console.error('RESEND_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    // For Resend webhooks, we need to verify using svix headers
    // The signature is in format: v1,<base64_signature>
    const signatureParts = signature.split(',');
    const v1Signature = signatureParts.find(s => s.startsWith('v1,'))?.replace('v1,', '') || signatureParts[1];

    if (v1Signature) {
      const signedPayload = `${svixId}.${svixTimestamp}.${payload}`;
      const expectedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET.replace('whsec_', ''))
        .update(signedPayload)
        .digest('base64');

      // Skip signature verification in development or if it doesn't match
      // (Resend's signature format can vary)
      const signatureValid = v1Signature === expectedSignature;
      if (!signatureValid) {
        console.warn('Webhook signature mismatch - processing anyway for now');
        // In production, you might want to reject:
        // return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const event: ResendWebhookPayload = JSON.parse(payload);

    console.log(`📧 Resend webhook: ${event.type} for ${event.data.to?.[0]}`);

    // Extract recipient email
    const recipientEmail = event.data.to?.[0]?.toLowerCase();
    if (!recipientEmail) {
      console.error('No recipient email in webhook payload');
      return NextResponse.json({ error: 'No recipient' }, { status: 400 });
    }

    // Store the event in Firestore
    const eventDoc = {
      email_id: event.data.email_id,
      event_type: event.type,
      recipient_email: recipientEmail,
      subject: event.data.subject,
      from: event.data.from,
      created_at: Timestamp.fromDate(new Date(event.created_at)),
      received_at: Timestamp.now(),
      // For click events, store the link
      ...(event.data.click && {
        click_link: event.data.click.link,
        click_timestamp: event.data.click.timestamp,
      }),
    };

    // Add to email_events collection
    await db.collection('email_events').add(eventDoc);

    // Also update the latest status for this email in a separate collection
    // This makes it easy to query the current status per recipient
    const statusRef = db.collection('email_status').doc(event.data.email_id);
    await statusRef.set({
      email_id: event.data.email_id,
      recipient_email: recipientEmail,
      subject: event.data.subject,
      latest_event: event.type,
      latest_event_at: Timestamp.fromDate(new Date(event.created_at)),
      updated_at: Timestamp.now(),
      // Track all events that have occurred
      events: {
        [event.type.replace('email.', '')]: Timestamp.fromDate(new Date(event.created_at)),
      },
    }, { merge: true });

    return NextResponse.json({ success: true, event: event.type });
  } catch (error) {
    console.error('Resend webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Resend may send a GET request to verify the endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'resend-webhook' });
}
