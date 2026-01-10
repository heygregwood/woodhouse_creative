// POST /api/admin/save-logo-permanent - Move logo from staging to permanent folder and return shareable URL

import { NextRequest, NextResponse } from 'next/server';
import { moveFile, getFileShareableLink, listFilesInFolder } from '@/lib/google-drive';

const STAGING_FOLDER_ID = process.env.GOOGLE_DRIVE_LOGOS_STAGING_FOLDER_ID || '';
const PERMANENT_FOLDER_ID = '1Vht1Dlh-IbyFpxvACbLRN-bVNSRTsrex'; // Logos folder

export async function POST(request: NextRequest) {
  try {
    const { stagingFileName, dealerNo } = await request.json();

    if (!stagingFileName || !dealerNo) {
      return NextResponse.json(
        { success: false, error: 'stagingFileName and dealerNo are required' },
        { status: 400 }
      );
    }

    console.log(`[save-logo-permanent] Moving ${stagingFileName} to permanent folder for dealer ${dealerNo}`);

    // 1. Find file in staging folder
    const stagingFiles = await listFilesInFolder(STAGING_FOLDER_ID);
    const file = stagingFiles.find(f => f.name === stagingFileName);

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File not found in staging folder' },
        { status: 404 }
      );
    }

    console.log(`[save-logo-permanent] Found file ${file.id}`);

    // 2. Move file from staging to permanent Logos folder
    const moved = await moveFile(file.id, STAGING_FOLDER_ID, PERMANENT_FOLDER_ID);

    if (!moved) {
      return NextResponse.json(
        { success: false, error: 'Failed to move file' },
        { status: 500 }
      );
    }

    console.log(`[save-logo-permanent] Moved file ${file.id}`);

    // 3. Get shareable link
    const logoUrl = await getFileShareableLink(file.id);

    if (!logoUrl) {
      return NextResponse.json(
        { success: false, error: 'Failed to get shareable link' },
        { status: 500 }
      );
    }

    console.log(`[save-logo-permanent] Generated shareable link: ${logoUrl}`);

    return NextResponse.json({
      success: true,
      logoUrl,
      fileId: file.id,
    });

  } catch (error) {
    console.error('[save-logo-permanent] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save logo permanently'
      },
      { status: 500 }
    );
  }
}
