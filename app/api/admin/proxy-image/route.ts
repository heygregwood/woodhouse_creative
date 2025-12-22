// GET /api/admin/proxy-image - Proxy images for canvas rendering
// Supports both Google Drive files (fileId) and external URLs (url)
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

function getGoogleAuth() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Missing Google Drive credentials');
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: serviceAccountEmail,
      private_key: privateKey.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
}

export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get('fileId');
  const externalUrl = request.nextUrl.searchParams.get('url');

  // Handle external URL proxy (for Brandfetch, website logos, etc.)
  if (externalUrl) {
    try {
      const response = await fetch(externalUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return NextResponse.json({ error: 'Failed to fetch external image' }, { status: response.status });
      }

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'image/png';

      return new NextResponse(Buffer.from(buffer), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      console.error('Error proxying external image:', error);
      return NextResponse.json({ error: 'Failed to fetch external image' }, { status: 500 });
    }
  }

  // Handle Google Drive file proxy
  if (!fileId) {
    return NextResponse.json({ error: 'Missing fileId or url parameter' }, { status: 400 });
  }

  try {
    const auth = getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });

    // Get file content
    const response = await drive.files.get({
      fileId,
      alt: 'media',
      supportsAllDrives: true,
    }, {
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(response.data as ArrayBuffer);

    // Get content type
    const metaResponse = await drive.files.get({
      fileId,
      fields: 'mimeType',
      supportsAllDrives: true,
    });

    const mimeType = metaResponse.data.mimeType || 'image/png';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error proxying Google Drive image:', error);
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    );
  }
}
