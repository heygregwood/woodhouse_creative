/**
 * GET /api/admin/post-thumbnail-image?fileId={id}
 *
 * Proxies a Google Drive video thumbnail through our server.
 * Tries multiple approaches to get the thumbnail since Google Drive
 * doesn't always provide accessible thumbnails for videos.
 *
 * Approach order:
 * 1. Try unauthenticated request (works for publicly shared files)
 * 2. Try with service account auth
 * 3. Try alternative URL formats
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

function getAuthClient() {
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

async function tryFetchImage(url: string, headers?: Record<string, string>): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.log(`[post-thumbnail-image] Failed ${url}: ${response.status}`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Verify it's actually an image and not an error page
    if (buffer.byteLength < 100 || !contentType.startsWith('image/')) {
      console.log(`[post-thumbnail-image] Invalid response from ${url}: ${contentType}, ${buffer.byteLength} bytes`);
      return null;
    }

    console.log(`[post-thumbnail-image] Success from ${url}: ${contentType}, ${buffer.byteLength} bytes`);
    return { buffer, contentType };
  } catch (error) {
    console.log(`[post-thumbnail-image] Error fetching ${url}:`, error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { error: 'fileId is required' },
        { status: 400 }
      );
    }

    console.log(`[post-thumbnail-image] Fetching thumbnail for fileId: ${fileId}`);

    // URLs to try for thumbnails
    const thumbnailUrls = [
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`,
      `https://lh3.googleusercontent.com/d/${fileId}=w400-h400-p-k-nu-iv1`,
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w320`,
    ];

    // Try 1: Unauthenticated requests first (for publicly shared files)
    for (const url of thumbnailUrls) {
      const result = await tryFetchImage(url);
      if (result) {
        return new NextResponse(result.buffer, {
          status: 200,
          headers: {
            'Content-Type': result.contentType,
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
    }

    // Try 2: With service account authentication
    console.log('[post-thumbnail-image] Trying with service account auth...');
    const auth = getAuthClient();
    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();

    if (accessToken.token) {
      const authHeaders = { 'Authorization': `Bearer ${accessToken.token}` };

      for (const url of thumbnailUrls) {
        const result = await tryFetchImage(url, authHeaders);
        if (result) {
          return new NextResponse(result.buffer, {
            status: 200,
            headers: {
              'Content-Type': result.contentType,
              'Cache-Control': 'public, max-age=86400',
            },
          });
        }
      }
    }

    // Try 3: Check if API returns a thumbnailLink
    console.log('[post-thumbnail-image] Checking API for thumbnailLink...');
    const drive = google.drive({ version: 'v3', auth });
    const fileResponse = await drive.files.get({
      fileId,
      fields: 'id,name,thumbnailLink',
      supportsAllDrives: true,
    });

    if (fileResponse.data.thumbnailLink) {
      console.log(`[post-thumbnail-image] API returned thumbnailLink: ${fileResponse.data.thumbnailLink}`);

      // Try larger size
      const largerUrl = fileResponse.data.thumbnailLink.replace(/=s\d+/, '=s400');

      // Try without auth first
      let result = await tryFetchImage(largerUrl);
      if (result) {
        return new NextResponse(result.buffer, {
          status: 200,
          headers: {
            'Content-Type': result.contentType,
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }

      // Try with auth
      if (accessToken.token) {
        result = await tryFetchImage(largerUrl, { 'Authorization': `Bearer ${accessToken.token}` });
        if (result) {
          return new NextResponse(result.buffer, {
            status: 200,
            headers: {
              'Content-Type': result.contentType,
              'Cache-Control': 'public, max-age=86400',
            },
          });
        }
      }
    }

    // All attempts failed
    console.error('[post-thumbnail-image] All thumbnail fetch attempts failed');
    return NextResponse.json(
      { error: 'No thumbnail available' },
      { status: 404 }
    );

  } catch (error: unknown) {
    console.error('[post-thumbnail-image] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch thumbnail' },
      { status: 500 }
    );
  }
}
