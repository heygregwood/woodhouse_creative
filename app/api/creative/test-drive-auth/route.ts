// app/api/creative/test-drive-auth/route.ts
// More detailed Google Drive authentication test

import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET() {
  const results: any = {
    step1_envVars: {},
    step2_authCreation: {},
    step3_driveClient: {},
    step4_listFiles: {},
    step5_getFolder: {},
  };

  try {
    // Step 1: Check environment variables
    results.step1_envVars = {
      hasEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      hasPrivateKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
      hasFolderId: !!process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
      emailValue: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      folderIdValue: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
      privateKeyLength: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.length || 0,
      privateKeyStartsWith: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.substring(0, 30) || '',
    };

    // Step 2: Create auth
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('Private key missing');
    }

    // Try to handle different newline formats
    const formattedKey = privateKey.replace(/\\n/g, '\n');

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: formattedKey,
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    results.step2_authCreation = {
      status: 'success',
      message: 'Auth object created',
    };

    // Step 3: Create drive client
    const drive = google.drive({ version: 'v3', auth });
    results.step3_driveClient = {
      status: 'success',
      message: 'Drive client created',
    };

    // Step 4: Try to list files (this tests authentication)
    try {
      const listResponse = await drive.files.list({
        pageSize: 5,
        fields: 'files(id, name)',
      });
      results.step4_listFiles = {
        status: 'success',
        message: 'Successfully authenticated and listed files',
        filesFound: listResponse.data.files?.length || 0,
        files: listResponse.data.files,
      };
    } catch (listError: any) {
      results.step4_listFiles = {
        status: 'error',
        message: listError.message,
        code: listError.code,
      };
    }

    // Step 5: Try to get the specific folder
    const folderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    if (folderId) {
      try {
        const folderResponse = await drive.files.get({
          fileId: folderId,
          fields: 'id, name, mimeType, owners, permissions',
        });
        results.step5_getFolder = {
          status: 'success',
          message: 'Folder found and accessible',
          folder: folderResponse.data,
        };
      } catch (folderError: any) {
        results.step5_getFolder = {
          status: 'error',
          message: folderError.message,
          code: folderError.code,
          details: folderError.errors || folderError.response?.data,
        };
      }
    }

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      results,
    });
  }

  const success = results.step4_listFiles.status === 'success';

  return NextResponse.json({
    success,
    results,
  });
}
