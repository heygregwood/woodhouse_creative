// POST /api/admin/save-logo-staging - Download logo to logos_staging folder in Google Drive
// Converts all images to PNG format before uploading
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';
import sharp from 'sharp';

// logos_staging folder ID in Google Drive
const STAGING_FOLDER_ID = process.env.GOOGLE_DRIVE_LOGOS_STAGING_FOLDER_ID;

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
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
}

interface SaveLogoRequest {
  dealerNo: string;
  displayName: string;
  logoUrl: string;
  logoSource: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveLogoRequest = await request.json();
    const { dealerNo, displayName, logoUrl, logoSource } = body;

    if (!dealerNo || !logoUrl) {
      return NextResponse.json({ error: 'Missing dealerNo or logoUrl' }, { status: 400 });
    }

    if (!STAGING_FOLDER_ID) {
      return NextResponse.json({ error: 'Staging folder not configured' }, { status: 500 });
    }

    // Fetch the logo
    const response = await fetch(logoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch logo: ${response.status}` }, { status: 400 });
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';

    // Convert image to PNG using sharp
    let pngBuffer: Buffer;
    const inputBuffer = Buffer.from(buffer);

    if (contentType.includes('svg')) {
      // SVG needs special handling - convert with density for quality
      pngBuffer = await sharp(inputBuffer, { density: 300 })
        .png()
        .toBuffer();
    } else {
      // All other formats (jpg, webp, gif, png) - convert to PNG
      pngBuffer = await sharp(inputBuffer)
        .png()
        .toBuffer();
    }

    // Create filename: DisplayName_DealerNo_Source.png (always PNG now)
    const safeName = displayName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const fileName = `${safeName}_${dealerNo}_${logoSource}.png`;

    // Upload to Google Drive staging folder
    const auth = getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });

    // Convert to Readable stream
    const stream = new Readable();
    stream.push(pngBuffer);
    stream.push(null);

    const file = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [STAGING_FOLDER_ID],
      },
      media: {
        mimeType: 'image/png',
        body: stream,
      },
      supportsAllDrives: true,
      fields: 'id, name, webViewLink',
    });

    return NextResponse.json({
      success: true,
      fileName: file.data.name,
      fileId: file.data.id,
      webViewLink: file.data.webViewLink,
    });
  } catch (error) {
    console.error('Error saving logo to staging:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save logo' },
      { status: 500 }
    );
  }
}
