// POST /api/admin/save-logo - Download logo, convert to PNG, and save to Google Drive
import { NextRequest, NextResponse } from 'next/server';
import { uploadToGoogleDrive } from '@/lib/google-drive';
import { updateLogo } from '@/lib/firestore-dealers';
import sharp from 'sharp';

// Logos folder path within the shared drive
const LOGOS_FOLDER_PATH = 'Creative Automation/Logos';

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')  // Remove illegal chars
    .replace(/\s+/g, ' ')           // Normalize spaces
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const { dealerNo, displayName, logoUrl, logoSource } = await request.json();

    if (!dealerNo || !displayName || !logoUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: dealerNo, displayName, logoUrl' },
        { status: 400 }
      );
    }

    console.log(`[SAVE-LOGO] Processing ${displayName} (${dealerNo})`);
    console.log(`[SAVE-LOGO] Logo URL: ${logoUrl}`);

    // Download the logo
    const imageResponse = await fetch(logoUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    if (!imageResponse.ok) {
      console.error(`[SAVE-LOGO] Failed to download: ${imageResponse.status}`);
      return NextResponse.json(
        { error: `Failed to download logo: ${imageResponse.status}` },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const contentType = imageResponse.headers.get('content-type') || 'image/png';

    console.log(`[SAVE-LOGO] Downloaded ${imageBuffer.length} bytes, type: ${contentType}`);

    // Convert to PNG using sharp
    let pngBuffer: Buffer;
    try {
      pngBuffer = await sharp(imageBuffer)
        .png()
        .toBuffer();
      console.log(`[SAVE-LOGO] Converted to PNG: ${pngBuffer.length} bytes`);
    } catch (conversionError) {
      console.error(`[SAVE-LOGO] Conversion failed, using original:`, conversionError);
      // If conversion fails (e.g., SVG), try to use original
      pngBuffer = imageBuffer;
    }

    // Create filename from display name (always .png now)
    const filename = `${sanitizeFilename(displayName)}.png`;

    console.log(`[SAVE-LOGO] Uploading as: ${filename}`);

    // Upload to Google Drive
    const uploadResult = await uploadToGoogleDrive({
      fileName: filename,
      folderPath: LOGOS_FOLDER_PATH,
      buffer: pngBuffer,
      mimeType: 'image/png',
    });

    console.log(`[SAVE-LOGO] Uploaded to Drive: ${uploadResult.webViewLink}`);

    // Update Firestore with new logo URL
    await updateLogo(dealerNo, uploadResult.webViewLink);

    console.log(`[SAVE-LOGO] Firestore updated for ${dealerNo}`);

    return NextResponse.json({
      success: true,
      fileId: uploadResult.id,
      filename,
      driveUrl: uploadResult.webViewLink,
      path: uploadResult.path,
    });
  } catch (error) {
    console.error('[SAVE-LOGO] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save logo' },
      { status: 500 }
    );
  }
}
