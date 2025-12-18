// app/api/creative/test-connection/route.ts
// Test endpoint to verify Google Drive and Creatomate connections

import { NextResponse } from 'next/server';
import { testConnection as testGoogleDrive } from '@/lib/google-drive';
import { testConnection as testCreatomate } from '@/lib/creatomate';

/**
 * GET /api/creative/test-connection
 *
 * Tests connections to:
 * - Google Drive API (service account authentication)
 * - Creatomate API (if API key is set)
 *
 * Use this endpoint to verify environment variables are correctly configured
 */
export async function GET() {
  const results: {
    googleDrive: {
      status: 'success' | 'error';
      message: string;
      details?: any;
    };
    creatomate: {
      status: 'success' | 'error';
      message: string;
      details?: any;
    };
    environmentVariables: {
      GOOGLE_SERVICE_ACCOUNT_EMAIL: boolean;
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: boolean;
      GOOGLE_DRIVE_ROOT_FOLDER_ID: boolean;
      CREATOMATE_API_KEY: boolean;
      CREATOMATE_WEBHOOK_SECRET: boolean;
    };
  } = {
    googleDrive: {
      status: 'error',
      message: 'Not tested',
    },
    creatomate: {
      status: 'error',
      message: 'Not tested',
    },
    environmentVariables: {
      GOOGLE_SERVICE_ACCOUNT_EMAIL: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
      GOOGLE_DRIVE_ROOT_FOLDER_ID: !!process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
      CREATOMATE_API_KEY: !!process.env.CREATOMATE_API_KEY,
      CREATOMATE_WEBHOOK_SECRET: !!process.env.CREATOMATE_WEBHOOK_SECRET,
    },
  };

  // Test Google Drive
  try {
    const driveConnected = await testGoogleDrive();

    if (driveConnected) {
      results.googleDrive = {
        status: 'success',
        message: 'Google Drive connection successful',
        details: {
          rootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
          serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        },
      };
    } else {
      results.googleDrive = {
        status: 'error',
        message: 'Google Drive connection failed',
        details: 'Check service account permissions and folder sharing',
      };
    }
  } catch (error) {
    results.googleDrive = {
      status: 'error',
      message: 'Google Drive connection error',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Test Creatomate (only if API key is set)
  if (process.env.CREATOMATE_API_KEY) {
    try {
      const creatomateConnected = await testCreatomate();

      if (creatomateConnected) {
        results.creatomate = {
          status: 'success',
          message: 'Creatomate API connection successful',
        };
      } else {
        results.creatomate = {
          status: 'error',
          message: 'Creatomate API connection failed',
          details: 'Check API key validity',
        };
      }
    } catch (error) {
      results.creatomate = {
        status: 'error',
        message: 'Creatomate API connection error',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  } else {
    results.creatomate = {
      status: 'error',
      message: 'Creatomate API key not set (optional for now)',
    };
  }

  // Determine overall status
  const allGood = results.googleDrive.status === 'success';

  return NextResponse.json({
    success: allGood,
    timestamp: new Date().toISOString(),
    results,
  });
}
