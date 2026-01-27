import { NextResponse } from 'next/server';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';

const TENANT_ID = process.env.MICROSOFT_TENANT_ID || '';
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || '';
const DRIVE_OWNER_EMAIL = process.env.SHAREPOINT_OWNER_EMAIL || 'greg@woodhouseagency.com';
const FILE_PATH = process.env.SHAREPOINT_FILE_PATH || '/Woodhouse Business/Woodhouse_Agency/Clients/AAE/Turnkey Social Media/Dealer Database/Turnkey Social Media - Dealers - Current.xlsm';

export async function GET() {
  try {
    console.log('[test-graph-api] Starting test...');
    console.log('[test-graph-api] Tenant ID:', TENANT_ID ? 'Set' : 'Missing');
    console.log('[test-graph-api] Client ID:', CLIENT_ID ? 'Set' : 'Missing');
    console.log('[test-graph-api] Client Secret:', CLIENT_SECRET ? 'Set' : 'Missing');

    if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
      return NextResponse.json({
        success: false,
        error: 'Missing Graph API credentials',
        details: {
          tenant: !!TENANT_ID,
          client: !!CLIENT_ID,
          secret: !!CLIENT_SECRET,
        },
      }, { status: 500 });
    }

    // Create credential
    const credential = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);

    // Create Graph client
    const client = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          const token = await credential.getToken(['https://graph.microsoft.com/.default']);
          return token?.token || '';
        },
      },
    });

    console.log('[test-graph-api] Graph client created, testing authentication...');

    // Step 1: Get user drive
    console.log('[test-graph-api] Getting drive for:', DRIVE_OWNER_EMAIL);
    const userResponse = await client.api(`/users/${DRIVE_OWNER_EMAIL}/drive`).get();
    console.log('[test-graph-api] Drive ID:', userResponse.id);

    // Step 2: Get file metadata
    console.log('[test-graph-api] Looking for file:', FILE_PATH);
    const fileResponse = await client.api(`/drives/${userResponse.id}/root:${FILE_PATH}`).get();
    console.log('[test-graph-api] File found:', fileResponse.name, 'Size:', fileResponse.size, 'bytes');

    // Step 3: Download first 1KB of file (just to test /content endpoint)
    console.log('[test-graph-api] Testing file download...');
    const contentStream = await client.api(`/drives/${userResponse.id}/items/${fileResponse.id}/content`).getStream();

    // Read just first chunk
    const firstChunk = await contentStream[Symbol.asyncIterator]().next();

    return NextResponse.json({
      success: true,
      message: 'Graph API connection successful!',
      fileInfo: {
        name: fileResponse.name,
        size: fileResponse.size,
        driveId: userResponse.id,
        fileId: fileResponse.id,
        firstChunkSize: firstChunk.value ? firstChunk.value.length : 0,
      },
    });

  } catch (error) {
    console.error('[test-graph-api] Error:', error);

    // Extract detailed error info
    const errorDetails: {
      message: string;
      type: string | undefined;
      statusCode?: number;
      code?: string;
      body?: unknown;
    } = {
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : undefined,
    };

    // Try to get Graph API error details
    if (error && typeof error === 'object') {
      const errObj = error as Record<string, unknown>;
      if ('statusCode' in errObj && typeof errObj.statusCode === 'number') {
        errorDetails.statusCode = errObj.statusCode;
      }
      if ('code' in errObj && typeof errObj.code === 'string') {
        errorDetails.code = errObj.code;
      }
      if ('body' in errObj) {
        try {
          errorDetails.body = typeof errObj.body === 'string' ? JSON.parse(errObj.body) : errObj.body;
        } catch {
          errorDetails.body = errObj.body;
        }
      }
    }

    return NextResponse.json({
      success: false,
      error: errorDetails.message,
      details: errorDetails,
    }, { status: 500 });
  }
}
