// lib/google-drive.ts
// Google Drive API integration for Creative Automation

import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';
import { Readable } from 'stream';

// Initialize Google Drive client
let driveClient: drive_v3.Drive | null = null;

/**
 * Get authenticated Google Drive client (singleton pattern)
 */
function getDriveClient(): drive_v3.Drive {
  if (driveClient) {
    return driveClient;
  }

  // Validate environment variables
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!serviceAccountEmail || !privateKey) {
    throw new Error(
      'Missing Google Drive credentials. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'
    );
  }

  // Initialize auth with service account credentials
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: serviceAccountEmail,
      private_key: privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  // Create Drive client
  driveClient = google.drive({ version: 'v3', auth });

  return driveClient;
}

/**
 * Upload file to Google Drive
 *
 * @param fileName - Name of the file (e.g., "Post_640_ABC Heating.mp4")
 * @param folderPath - Path to folder (e.g., "Dealers/ABC Heating/2025-11")
 * @param buffer - File content as Buffer or ArrayBuffer
 * @param mimeType - MIME type of the file (e.g., "video/mp4")
 * @returns File metadata including Drive file ID and shareable link
 */
export async function uploadToGoogleDrive({
  fileName,
  folderPath,
  buffer,
  mimeType,
}: {
  fileName: string;
  folderPath: string;
  buffer: Buffer | ArrayBuffer;
  mimeType: string;
}): Promise<{
  id: string;
  name: string;
  webViewLink: string;
  path: string;
}> {
  try {
    const drive = getDriveClient();

    // Ensure folder hierarchy exists and get folder ID
    const folderId = await ensureFolderPath(folderPath);

    // Convert ArrayBuffer to Buffer if needed
    const fileBuffer = buffer instanceof ArrayBuffer
      ? Buffer.from(buffer)
      : buffer;

    // Convert Buffer to Stream (Google Drive API requires a stream)
    const fileStream = Readable.from(fileBuffer);

    // Upload file
    // Note: supportsAllDrives is required for Shared Drives (Google Workspace)
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
        mimeType: mimeType,
      },
      media: {
        mimeType: mimeType,
        body: fileStream,
      },
      fields: 'id, name, webViewLink',
      supportsAllDrives: true,
    });

    if (!response.data.id || !response.data.name || !response.data.webViewLink) {
      throw new Error('Google Drive upload response missing required fields');
    }

    return {
      id: response.data.id,
      name: response.data.name,
      webViewLink: response.data.webViewLink,
      path: `${folderPath}/${fileName}`,
    };
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    throw new Error(
      `Failed to upload file to Google Drive: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Ensure folder path exists in Google Drive, creating folders as needed
 *
 * @param path - Folder path like "Dealers/ABC Heating/2025-11"
 * @returns Final folder ID
 */
async function ensureFolderPath(path: string): Promise<string> {
  const drive = getDriveClient();
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

  if (!rootFolderId) {
    throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID environment variable not set');
  }

  // Split path into parts
  const parts = path.split('/').filter(Boolean);
  let currentFolderId = rootFolderId;

  // Navigate/create folder hierarchy
  for (const part of parts) {
    // Escape single quotes in folder name for query
    const escapedPart = part.replace(/'/g, "\\'");

    // Check if folder exists
    const query = `name='${escapedPart}' and '${currentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

    const existingFolders = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (existingFolders.data.files && existingFolders.data.files.length > 0) {
      // Folder exists, use it
      currentFolderId = existingFolders.data.files[0].id!;
    } else {
      // Create folder
      const newFolder = await drive.files.create({
        requestBody: {
          name: part,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [currentFolderId],
        },
        fields: 'id',
        supportsAllDrives: true,
      });

      if (!newFolder.data.id) {
        throw new Error(`Failed to create folder: ${part}`);
      }

      currentFolderId = newFolder.data.id;
    }
  }

  return currentFolderId;
}

/**
 * Get file by ID
 *
 * @param fileId - Google Drive file ID
 * @returns File metadata
 */
export async function getFile(fileId: string): Promise<{
  id: string;
  name: string;
  mimeType: string;
  size: string;
  webViewLink: string;
} | null> {
  try {
    const drive = getDriveClient();

    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, webViewLink',
      supportsAllDrives: true,
    });

    if (!response.data) {
      return null;
    }

    return {
      id: response.data.id!,
      name: response.data.name!,
      mimeType: response.data.mimeType!,
      size: response.data.size!,
      webViewLink: response.data.webViewLink!,
    };
  } catch (error) {
    console.error('Error getting file from Google Drive:', error);
    return null;
  }
}

/**
 * Delete file by ID
 *
 * @param fileId - Google Drive file ID
 * @returns true if deleted successfully
 */
export async function deleteFile(fileId: string): Promise<boolean> {
  try {
    const drive = getDriveClient();
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
    });
    return true;
  } catch (error) {
    console.error('Error deleting file from Google Drive:', error);
    return false;
  }
}

/**
 * Test Google Drive connection
 *
 * @returns true if connection works
 */
export async function testConnection(): Promise<boolean> {
  try {
    const drive = getDriveClient();
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

    if (!rootFolderId) {
      console.error('GOOGLE_DRIVE_ROOT_FOLDER_ID not set');
      return false;
    }

    // Try to get root folder metadata
    const response = await drive.files.get({
      fileId: rootFolderId,
      fields: 'id, name',
      supportsAllDrives: true,
    });

    if (response.data && response.data.id) {
      console.log(`Google Drive connection successful. Root folder: ${response.data.name}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Google Drive connection test failed:', error);
    return false;
  }
}
