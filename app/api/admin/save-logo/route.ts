// POST /api/admin/save-logo - Download logo and save to Google Drive
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { uploadToGoogleDrive } from '@/lib/google-drive';

const DB_PATH = path.join(process.cwd(), 'data', 'sqlite', 'creative.db');

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

    // Determine file extension
    let extension = 'png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg';
    else if (contentType.includes('webp')) extension = 'webp';
    else if (contentType.includes('gif')) extension = 'gif';
    else if (contentType.includes('svg')) extension = 'svg';

    // Create filename from display name (matches Creatomate Company Name)
    const filename = `${sanitizeFilename(displayName)}.${extension}`;

    console.log(`[SAVE-LOGO] Uploading as: ${filename}`);

    // Upload to Google Drive
    const uploadResult = await uploadToGoogleDrive({
      fileName: filename,
      folderPath: LOGOS_FOLDER_PATH,
      buffer: imageBuffer,
      mimeType: contentType,
    });

    console.log(`[SAVE-LOGO] Uploaded to Drive: ${uploadResult.webViewLink}`);

    // Update database with new logo URL
    const db = new Database(DB_PATH);
    db.prepare(`
      UPDATE dealers 
      SET creatomate_logo = ?, logo_source = ?, updated_at = CURRENT_TIMESTAMP
      WHERE dealer_no = ?
    `).run(uploadResult.webViewLink, logoSource, dealerNo);
    db.close();

    console.log(`[SAVE-LOGO] Database updated for ${dealerNo}`);

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
