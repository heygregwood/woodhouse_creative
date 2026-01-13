/**
 * Microsoft Graph API Authentication using Device Code Flow with MSAL
 *
 * This module handles OAuth2 device code authentication for Microsoft Graph API.
 * Uses MSAL directly for proper refresh token handling (tokens last up to 90 days).
 *
 * How it works:
 * 1. App requests a device code from Microsoft
 * 2. User visits microsoft.com/devicelogin and enters the code
 * 3. User signs in and grants permissions
 * 4. App receives access token + refresh token
 * 5. Tokens are cached to .microsoft-token-cache.json
 * 6. On subsequent calls, refresh token is used to get new access tokens silently
 *
 * Token Lifetimes:
 * - Access token: ~1 hour (auto-refreshed using refresh token)
 * - Refresh token: Up to 90 days of inactivity
 * - Re-authentication only needed every 90 days (or if you revoke access)
 *
 * Usage:
 *   import { getAuthenticatedGraphClient } from './microsoft-auth';
 *   const client = await getAuthenticatedGraphClient();
 *   // Use client with delegated permissions
 */

import { Client } from '@microsoft/microsoft-graph-client';
import {
  PublicClientApplication,
  DeviceCodeRequest,
  AuthenticationResult,
  AccountInfo,
  SilentFlowRequest,
} from '@azure/msal-node';
import * as fs from 'fs';
import * as path from 'path';

// Azure App Registration credentials
const TENANT_ID = process.env.MICROSOFT_TENANT_ID || '';
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';

// Token cache file location - committed to repo for multi-machine sync
const TOKEN_CACHE_PATH = path.join(process.cwd(), '.microsoft-token-cache.json');

// Required Graph API scopes
const SCOPES = [
  'https://graph.microsoft.com/Files.ReadWrite.All',
  'https://graph.microsoft.com/User.Read',
  'offline_access', // Required for refresh tokens
];

// MSAL configuration
const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
  },
  cache: {
    // We'll handle cache persistence ourselves
  },
};

let msalInstance: PublicClientApplication | null = null;

/**
 * Get or create MSAL instance with cache loaded
 */
async function getMsalInstance(): Promise<PublicClientApplication> {
  if (!TENANT_ID || !CLIENT_ID) {
    throw new Error(
      'Missing Microsoft Azure credentials. Set MICROSOFT_TENANT_ID and MICROSOFT_CLIENT_ID environment variables.'
    );
  }

  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);

    // Load cache from file if it exists
    if (fs.existsSync(TOKEN_CACHE_PATH)) {
      try {
        const cacheData = fs.readFileSync(TOKEN_CACHE_PATH, 'utf-8');
        msalInstance.getTokenCache().deserialize(cacheData);
        console.log('[microsoft-auth] Loaded token cache from file');
      } catch (error) {
        console.log('[microsoft-auth] Could not load token cache:', error);
      }
    }
  }

  return msalInstance;
}

/**
 * Save MSAL token cache to file
 */
async function saveCache(): Promise<void> {
  if (!msalInstance) return;

  try {
    const cacheData = msalInstance.getTokenCache().serialize();
    fs.writeFileSync(TOKEN_CACHE_PATH, cacheData);
    console.log('[microsoft-auth] Token cache saved');
  } catch (error) {
    console.error('[microsoft-auth] Could not save token cache:', error);
  }
}

/**
 * Default device code callback - prints instructions to console
 */
function defaultDeviceCodeCallback(response: { userCode: string; verificationUri: string; message: string }): void {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('MICROSOFT AUTHENTICATION REQUIRED');
  console.log('='.repeat(60));
  console.log('');
  console.log('To sign in, open a browser and go to:');
  console.log(`  ${response.verificationUri}`);
  console.log('');
  console.log('Enter this code:');
  console.log(`  ${response.userCode}`);
  console.log('');
  console.log('Sign in with: greg@woodhouseagency.com');
  console.log('');
  console.log('(Token will be valid for up to 90 days)');
  console.log('='.repeat(60));
  console.log('\n');
}

export interface AuthOptions {
  /** Custom callback for device code display (for web UI) */
  deviceCodeCallback?: (response: { userCode: string; verificationUri: string; message: string }) => void;
  /** Force re-authentication even if cached token exists */
  forceRefresh?: boolean;
}

/**
 * Try to acquire token silently using cached refresh token
 */
async function acquireTokenSilent(pca: PublicClientApplication): Promise<AuthenticationResult | null> {
  let accounts: AccountInfo[] = [];

  try {
    accounts = await pca.getTokenCache().getAllAccounts();
  } catch (error) {
    console.log('[microsoft-auth] Could not get accounts from cache');
    return null;
  }

  if (!accounts || accounts.length === 0) {
    console.log('[microsoft-auth] No cached accounts found');
    return null;
  }

  // Use the first account (should only be one for this app)
  const account = accounts[0];
  console.log('[microsoft-auth] Found cached account:', account?.username || 'unknown');

  const silentRequest: SilentFlowRequest = {
    account,
    scopes: SCOPES,
  };

  try {
    const result = await pca.acquireTokenSilent(silentRequest);
    console.log('[microsoft-auth] Token acquired silently (using refresh token)');
    return result;
  } catch (error) {
    console.log('[microsoft-auth] Silent token acquisition failed, need interactive auth');
    return null;
  }
}

/**
 * Acquire token using device code flow (interactive)
 */
async function acquireTokenDeviceCode(
  pca: PublicClientApplication,
  callback?: (response: { userCode: string; verificationUri: string; message: string }) => void
): Promise<AuthenticationResult> {
  const deviceCodeRequest: DeviceCodeRequest = {
    scopes: SCOPES,
    deviceCodeCallback: callback || defaultDeviceCodeCallback,
  };

  const result = await pca.acquireTokenByDeviceCode(deviceCodeRequest);

  if (!result) {
    throw new Error('Failed to acquire token');
  }

  return result;
}

/**
 * Get an authenticated Microsoft Graph client using device code flow
 *
 * @param options - Authentication options
 * @returns Authenticated Graph client with delegated permissions
 */
export async function getAuthenticatedGraphClient(options: AuthOptions = {}): Promise<Client> {
  const pca = await getMsalInstance();

  let authResult: AuthenticationResult | null = null;

  // Try silent auth first (unless force refresh)
  if (!options.forceRefresh) {
    authResult = await acquireTokenSilent(pca);
  }

  // Fall back to interactive device code flow
  if (!authResult) {
    console.log('[microsoft-auth] Starting device code authentication...');
    authResult = await acquireTokenDeviceCode(pca, options.deviceCodeCallback);
    console.log('[microsoft-auth] Authentication successful!');
  }

  // Save cache after successful auth
  await saveCache();

  // Create Graph client with the access token
  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => authResult!.accessToken,
    },
  });
}

/**
 * Clear the cached tokens (for logout or re-authentication)
 */
export async function clearTokenCache(): Promise<void> {
  try {
    if (fs.existsSync(TOKEN_CACHE_PATH)) {
      fs.unlinkSync(TOKEN_CACHE_PATH);
      console.log('[microsoft-auth] Token cache file deleted');
    }
    // Reset the MSAL instance
    msalInstance = null;
    console.log('[microsoft-auth] Token cache cleared');
  } catch (error) {
    console.error('[microsoft-auth] Could not clear token cache:', error);
  }
}

/**
 * Check if we have a valid cached token (may need refresh)
 */
export function hasValidToken(): boolean {
  if (!fs.existsSync(TOKEN_CACHE_PATH)) {
    return false;
  }

  try {
    const cacheData = fs.readFileSync(TOKEN_CACHE_PATH, 'utf-8');
    const cache = JSON.parse(cacheData);
    // Check if there are any accounts in the cache
    return cache.Account && Object.keys(cache.Account).length > 0;
  } catch {
    return false;
  }
}

/**
 * Get info about the cached account (if any)
 */
export async function getCachedAccountInfo(): Promise<AccountInfo | null> {
  try {
    const pca = await getMsalInstance();
    const accounts = await pca.getTokenCache().getAllAccounts();
    return accounts && accounts.length > 0 ? accounts[0] : null;
  } catch {
    return null;
  }
}
