// app/api/creative/manual-webhook/route.ts
// Manual webhook trigger for testing - processes a completed Creatomate render

import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/creative/manual-webhook
 *
 * Manually trigger webhook processing for a Creatomate render
 * Use this when Creatomate webhook fails but render succeeded
 *
 * Request body: Copy the JSON from Creatomate API log
 */
export async function POST(request: NextRequest) {
  try {
    // Get the Creatomate render data
    const renderData = await request.json();

    // Forward to our webhook handler
    const webhookUrl = `${request.nextUrl.origin}/api/webhooks/creatomate`;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(renderData),
    });

    const result = await response.json();

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'Webhook processed successfully',
        result,
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Webhook processing failed',
        error: result,
      }, { status: response.status });
    }
  } catch (error) {
    console.error('Error triggering manual webhook:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
