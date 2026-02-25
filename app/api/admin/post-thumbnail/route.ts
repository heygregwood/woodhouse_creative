/**
 * GET /api/admin/post-thumbnail?postNumber={number}
 *
 * Fetches a video thumbnail from Google Drive for a specific post number.
 * Searches for videos matching "Post {number}_*.mp4" pattern and returns
 * the thumbnail URL from the first match.
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Dealers folder in Google Drive
const DEALERS_FOLDER_ID = '1QwyyE9Pq-p8u-TEz7B5nC-14BERpDPmv';

function getDriveClient() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Missing Google Drive credentials');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: serviceAccountEmail,
      private_key: privateKey.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postNumber = searchParams.get('postNumber');

    if (!postNumber) {
      return NextResponse.json(
        { error: 'postNumber is required' },
        { status: 400 }
      );
    }

    const drive = getDriveClient();

    // Search for video files matching "Post {number}_" pattern
    // Using fullText search since name contains doesn't work well with spaces
    const searchQuery = `name contains 'Post ${postNumber}_' and mimeType contains 'video' and trashed = false`;

    const response = await drive.files.list({
      q: searchQuery,
      fields: 'files(id, name, thumbnailLink, webViewLink, webContentLink, iconLink, hasThumbnail, createdTime, mimeType)',
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      orderBy: 'createdTime desc',
    });

    const files = response.data.files || [];

    console.log('[post-thumbnail] Search query:', searchQuery);
    console.log('[post-thumbnail] Files found:', files.length);
    if (files.length > 0) {
      console.log('[post-thumbnail] First file:', JSON.stringify(files[0], null, 2));
    }

    if (files.length === 0) {
      return NextResponse.json({
        success: true,
        found: false,
        postNumber: parseInt(postNumber),
        message: 'No video found for this post',
      });
    }

    const file = files[0];

    // Google Drive's API often doesn't return thumbnailLink for videos via service accounts
    // Workaround: Construct thumbnail URL directly using the file ID
    // Format: https://drive.google.com/thumbnail?id={FILE_ID}&sz=w{WIDTH}
    // This URL works for files that are viewable (shared or in shared drives)
    const constructedThumbnailUrl = file.id
      ? `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`
      : null;

    return NextResponse.json({
      success: true,
      found: true,
      postNumber: parseInt(postNumber),
      video: {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType || null,
        hasThumbnail: file.hasThumbnail || false,
        // Use API thumbnailLink if available, otherwise use constructed URL
        thumbnailUrl: file.thumbnailLink || constructedThumbnailUrl,
        webViewLink: file.webViewLink || null,
        webContentLink: file.webContentLink || null,
        iconLink: file.iconLink || null,
        createdTime: file.createdTime || null,
      },
    });
  } catch (error: unknown) {
    console.error('[post-thumbnail] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch thumbnail' },
      { status: 500 }
    );
  }
}
