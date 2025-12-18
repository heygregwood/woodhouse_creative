// lib/creatomate.ts
// Creatomate API integration for Creative Automation

import type {
  CreatomateRenderRequest,
  CreatomateRenderResponse,
  CreatomateMetadata,
} from './types/renderQueue';
import crypto from 'crypto';

const CREATOMATE_API_BASE = 'https://api.creatomate.com/v1';

/**
 * Create a render request to Creatomate API
 *
 * @param templateId - Creatomate template ID
 * @param businessData - Business data for template modifications
 * @param metadata - Metadata to attach to the render (jobId, businessId, postNumber)
 * @param webhookUrl - Webhook URL for completion notification
 * @returns Render ID from Creatomate
 */
export async function createRender({
  templateId,
  businessData,
  metadata,
  webhookUrl,
}: {
  templateId: string;
  businessData: {
    businessName: string;
    logoUrl: string;
    phone: string;
    website?: string;  // Optional - not in current template
  };
  metadata: CreatomateMetadata;
  webhookUrl: string;
}): Promise<{ renderId: string; status: string }> {
  const apiKey = process.env.CREATOMATE_API_KEY;

  if (!apiKey) {
    throw new Error('CREATOMATE_API_KEY environment variable not set');
  }

  // Build modifications object based on template variables
  // Field names match Creatomate template: Post 700 TEST
  const modifications: Record<string, string> = {
    'Public-Company-Name': businessData.businessName,
    'Public-Company-Phone': businessData.phone,
    'Logo': businessData.logoUrl,
  };

  const requestBody: CreatomateRenderRequest = {
    template_id: templateId,
    webhook_url: webhookUrl,
    metadata: JSON.stringify(metadata),
    modifications,
  };

  try {
    const response = await fetch(`${CREATOMATE_API_BASE}/renders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Creatomate API error (${response.status}): ${errorText}`
      );
    }

    const data = await response.json() as CreatomateRenderResponse[];

    // Creatomate returns an array with one item
    if (!data || data.length === 0) {
      throw new Error('Creatomate API returned empty response');
    }

    const render = data[0];

    return {
      renderId: render.id,
      status: render.status,
    };
  } catch (error) {
    console.error('Error creating Creatomate render:', error);
    throw new Error(
      `Failed to create render: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get render status from Creatomate API
 *
 * @param renderId - Render ID from Creatomate
 * @returns Render status and URL if completed
 */
export async function getRenderStatus(renderId: string): Promise<{
  status: string;
  url?: string;
  error?: string;
}> {
  const apiKey = process.env.CREATOMATE_API_KEY;

  if (!apiKey) {
    throw new Error('CREATOMATE_API_KEY environment variable not set');
  }

  try {
    const response = await fetch(`${CREATOMATE_API_BASE}/renders/${renderId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Creatomate API error (${response.status}): ${errorText}`
      );
    }

    const data = await response.json() as CreatomateRenderResponse;

    return {
      status: data.status,
      url: data.url,
      error: data.error,
    };
  } catch (error) {
    console.error('Error getting Creatomate render status:', error);
    throw new Error(
      `Failed to get render status: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Verify Creatomate webhook signature
 *
 * @param signature - Signature from x-creatomate-signature header
 * @param body - Raw request body string
 * @returns true if signature is valid
 */
export function verifyWebhookSignature(
  signature: string,
  body: string
): boolean {
  const secret = process.env.CREATOMATE_WEBHOOK_SECRET;

  if (!secret) {
    console.warn('CREATOMATE_WEBHOOK_SECRET not set, skipping signature verification');
    return true; // Allow in development
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    return signature === expectedSignature;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Download rendered video from Creatomate CDN
 *
 * @param url - Video URL from Creatomate
 * @returns Video content as ArrayBuffer
 */
export async function downloadVideo(url: string): Promise<ArrayBuffer> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download video: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('Downloaded video is empty');
    }

    return arrayBuffer;
  } catch (error) {
    console.error('Error downloading video from Creatomate:', error);
    throw new Error(
      `Failed to download video: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Estimate credits needed for a render
 *
 * Based on: 30 second video at 720p = ~7 credits
 * Formula: (duration in seconds / 60) * 14 credits per minute
 *
 * @param durationSeconds - Video duration in seconds
 * @param resolution - Video resolution (default: 720p)
 * @returns Estimated credits
 */
export function estimateCredits(
  durationSeconds: number,
  resolution: '720p' | '1080p' = '720p'
): number {
  const baseCreditsPerMinute = resolution === '1080p' ? 28 : 14;
  const durationMinutes = durationSeconds / 60;
  return Math.ceil(durationMinutes * baseCreditsPerMinute);
}

/**
 * Test Creatomate API connection
 *
 * @returns true if connection works
 */
export async function testConnection(): Promise<boolean> {
  const apiKey = process.env.CREATOMATE_API_KEY;

  if (!apiKey) {
    console.error('CREATOMATE_API_KEY not set');
    return false;
  }

  try {
    // Try to list templates (simple API call)
    const response = await fetch(`${CREATOMATE_API_BASE}/templates?limit=1`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      console.log('Creatomate API connection successful');
      return true;
    }

    console.error('Creatomate API connection failed:', response.status);
    return false;
  } catch (error) {
    console.error('Creatomate API connection test failed:', error);
    return false;
  }
}
