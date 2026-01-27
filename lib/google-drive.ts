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

// In-process lock to prevent duplicate folder creation when multiple
// concurrent webhook handlers try to create the same folder path.
// Key: full folder path, Value: in-flight promise resolving to folder ID.
const folderCreationLocks = new Map<string, Promise<string>>();

/**
 * Ensure folder path exists in Google Drive, creating folders as needed.
 *
 * Uses two layers of race condition protection:
 * 1. In-process promise lock — concurrent calls for the same path within
 *    the same serverless instance share a single creation promise.
 * 2. Post-creation verification — after creating a folder, re-queries
 *    Google Drive to detect cross-instance duplicates and cleans them up.
 *
 * @param path - Folder path like "Dealers/ABC Heating/2025-11"
 * @returns Final folder ID
 */
async function ensureFolderPath(path: string): Promise<string> {
  // If another call is already creating this exact path, wait for it
  const existingLock = folderCreationLocks.get(path);
  if (existingLock) {
    console.log(`[google-drive] Waiting for in-flight folder creation: ${path}`);
    return existingLock;
  }

  const promise = ensureFolderPathImpl(path);
  folderCreationLocks.set(path, promise);

  try {
    return await promise;
  } finally {
    folderCreationLocks.delete(path);
  }
}

async function ensureFolderPathImpl(path: string): Promise<string> {
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

      // Verify no duplicate was created by a concurrent serverless instance.
      // Re-query immediately after creation to detect cross-instance races.
      const verifyFolders = await drive.files.list({
        q: query,
        fields: 'files(id, name, createdTime)',
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        orderBy: 'createdTime',
      });

      if (verifyFolders.data.files && verifyFolders.data.files.length > 1) {
        // Race condition detected — multiple folders with the same name.
        // Use the oldest (first-created) folder and delete ours if it's the duplicate.
        const oldestFolder = verifyFolders.data.files[0];
        console.log(`[google-drive] Duplicate folder detected for "${part}", using oldest: ${oldestFolder.id}`);

        if (oldestFolder.id !== newFolder.data.id) {
          try {
            await drive.files.delete({
              fileId: newFolder.data.id,
              supportsAllDrives: true,
            });
            console.log(`[google-drive] Cleaned up duplicate folder: ${newFolder.data.id}`);
          } catch (deleteError) {
            console.error(`[google-drive] Failed to clean up duplicate folder: ${newFolder.data.id}`, deleteError);
          }
        }

        currentFolderId = oldestFolder.id!;
      } else {
        currentFolderId = newFolder.data.id;
      }
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
 * List files in a folder
 *
 * @param folderId - Google Drive folder ID
 * @param mimeType - Optional filter by MIME type (e.g., "video/mp4")
 * @returns Array of files with id, name, and mimeType
 */
export async function listFilesInFolder(
  folderId: string,
  mimeType?: string
): Promise<{ id: string; name: string; mimeType: string }[]> {
  try {
    const drive = getDriveClient();

    let query = `'${folderId}' in parents and trashed=false`;
    if (mimeType) {
      query += ` and mimeType='${mimeType}'`;
    }

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    return (response.data.files || []).map((f) => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
    }));
  } catch (error) {
    console.error('Error listing files in folder:', error);
    return [];
  }
}

/**
 * Get folder ID by path (creates if not exists)
 *
 * @param path - Folder path like "Dealers/ABC Heating"
 * @returns Folder ID
 */
export async function getFolderIdByPath(path: string): Promise<string> {
  return ensureFolderPath(path);
}

/**
 * Move file to a different folder
 *
 * @param fileId - Google Drive file ID
 * @param currentParentId - Current parent folder ID
 * @param newParentId - New parent folder ID
 * @returns true if moved successfully
 */
export async function moveFile(
  fileId: string,
  currentParentId: string,
  newParentId: string
): Promise<boolean> {
  try {
    const drive = getDriveClient();

    await drive.files.update({
      fileId,
      addParents: newParentId,
      removeParents: currentParentId,
      supportsAllDrives: true,
    });

    return true;
  } catch (error) {
    console.error('Error moving file:', error);
    return false;
  }
}

/**
 * Archive old post videos in a dealer's folder
 *
 * Moves all "Post XXX_*.mp4" files that are NOT in the activePostNumbers list
 * to an "Archive" subfolder within the dealer's folder.
 *
 * @param dealerFolderPath - Path to dealer folder (e.g., "Dealers/ABC Heating")
 * @param activePostNumbers - Set of post numbers that should NOT be archived
 * @returns Number of files archived
 */
export async function archiveOldPosts(
  dealerFolderPath: string,
  activePostNumbers: Set<number>
): Promise<number> {
  try {
    const drive = getDriveClient();

    // Get dealer folder ID
    const dealerFolderId = await getFolderIdByPath(dealerFolderPath);

    // List all video files in dealer folder
    const files = await listFilesInFolder(dealerFolderId, 'video/mp4');

    // Filter to only "Post XXX_*.mp4" files
    const postFiles = files.filter((f) => f.name.startsWith('Post '));

    // Find files to archive (post numbers not in activePostNumbers)
    const filesToArchive: { id: string; name: string; postNumber: number }[] = [];

    for (const file of postFiles) {
      // Extract post number from filename like "Post 666_Dealer Name.mp4"
      const match = file.name.match(/^Post (\d+)_/);
      if (match) {
        const postNumber = parseInt(match[1]);
        if (!activePostNumbers.has(postNumber)) {
          filesToArchive.push({ id: file.id, name: file.name, postNumber });
        }
      }
    }

    if (filesToArchive.length === 0) {
      return 0;
    }

    // Get or create Archive subfolder
    const archiveFolderId = await ensureFolderPath(`${dealerFolderPath}/Archive`);

    // Move files to archive
    let archivedCount = 0;
    for (const file of filesToArchive) {
      const success = await moveFile(file.id, dealerFolderId, archiveFolderId);
      if (success) {
        console.log(`📦 Archived: ${file.name}`);
        archivedCount++;
      } else {
        console.error(`Failed to archive: ${file.name}`);
      }
    }

    return archivedCount;
  } catch (error) {
    console.error('Error archiving old posts:', error);
    return 0;
  }
}

/**
 * Get shareable link for a file
 *
 * Sets file permissions to "anyone with link can view" and returns the shareable link
 *
 * @param fileId - Google Drive file ID
 * @returns Shareable link or null if failed
 */
export async function getFileShareableLink(fileId: string): Promise<string | null> {
  try {
    const drive = getDriveClient();

    // Try to set permissions to "anyone with link can view"
    // This may fail on Shared Drives where permissions are inherited - that's OK
    try {
      await drive.permissions.create({
        fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
        supportsAllDrives: true,
      });
    } catch (permError: unknown) {
      // 403 means inherited permissions exist (Shared Drive) - file is already shared
      const error = permError as { code?: number };
      if (error.code !== 403) {
        throw permError;
      }
      console.log('[google-drive] File inherits sharing from parent folder, skipping permission creation');
    }

    // Get file metadata with webViewLink
    const response = await drive.files.get({
      fileId,
      fields: 'webViewLink',
      supportsAllDrives: true,
    });

    return response.data.webViewLink || null;
  } catch (error) {
    console.error('Error getting shareable link:', error);
    return null;
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
