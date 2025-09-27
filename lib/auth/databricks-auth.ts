/**
 * Centralized Databricks authentication module
 * Supports both OAuth (service principal) and CLI-based OAuth U2M authentication
 */
import { getHostUrl, getHostDomain } from '@/lib/databricks-host-utils';

// Token management for OAuth authentication
let oauthToken: string | null = null;
let oauthTokenExpiresAt = 0;

// Import server-only functions
import { getDatabricksUserIdentity as serverGetUserIdentity, getDatabricksCliToken as serverGetCliToken } from './databricks-auth-server';

export type AuthMethod = 'oauth' | 'cli' | 'none';

/**
 * Determine which authentication method to use
 */
export function getAuthMethod(): AuthMethod {
  // Check for OAuth (service principal) credentials
  if (shouldUseOAuth()) {
    return 'oauth';
  }

  // Check for CLI-based authentication
  if (shouldUseCLIAuth()) {
    return 'cli';
  }

  return 'none';
}

/**
 * Check if we should use OAuth authentication
 */
export function shouldUseOAuth(): boolean {
  const clientId = process.env.DATABRICKS_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET;

  try {
    getHostDomain(); // This will throw if DATABRICKS_HOST is not set
    return !!(clientId && clientSecret);
  } catch {
    return false;
  }
}

/**
 * Check if we should use CLI-based OAuth U2M authentication
 */
export function shouldUseCLIAuth(): boolean {
  const configProfile = process.env.DATABRICKS_CONFIG_PROFILE;
  const databricksHost = process.env.DATABRICKS_HOST;

  // CLI auth is available if we have a profile or a host
  return !!(configProfile || databricksHost);
}

/**
 * Get a fresh Databricks OAuth token, with caching
 */
export async function getDatabricksOAuthToken(): Promise<string> {
  // Check if we have a valid cached token
  if (oauthToken && Date.now() < oauthTokenExpiresAt) {
    return oauthToken;
  }

  const clientId = process.env.DATABRICKS_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET, and DATABRICKS_HOST must be set for OAuth authentication',
    );
  }

  // Mint a new OAuth token
  const tokenUrl = `${getHostUrl()}/oidc/v1/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=all-apis',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get OAuth token: ${response.status} ${errorText}`,
    );
  }

  const data = await response.json();
  const accessToken = data.access_token;

  if (!accessToken) {
    throw new Error('No access token received from OAuth response');
  }

  oauthToken = accessToken;
  // Set expiration with a 10-minute buffer (OAuth tokens typically expire in 1 hour)
  // We want to refresh well before expiry to avoid any edge cases
  const expiresInSeconds = data.expires_in || 3600; // Default to 1 hour if not provided
  const bufferSeconds = Math.min(600, Math.floor(expiresInSeconds * 0.2)); // 10 minutes or 20% of lifetime, whichever is smaller
  oauthTokenExpiresAt = Date.now() + (expiresInSeconds - bufferSeconds) * 1000;

  console.log(`[OAuth] Token acquired, expires in ${expiresInSeconds}s, will refresh in ${expiresInSeconds - bufferSeconds}s`);

  return accessToken;
}

/**
 * Get the current user's identity using the Databricks CLI
 */
export async function getDatabricksUserIdentity(): Promise<string> {
  // Check if running on client-side
  if (typeof window !== 'undefined') {
    throw new Error('CLI authentication is only available on the server side');
  }

  return serverGetUserIdentity();
}

/**
 * Get a token using the Databricks CLI OAuth U2M authentication
 */
export async function getDatabricksCliToken(): Promise<string> {
  // Check if running on client-side
  if (typeof window !== 'undefined') {
    throw new Error('CLI authentication is only available on the server side');
  }

  return serverGetCliToken();
}

/**
 * Get a Databricks authentication token using the best available method
 */
export async function getDatabricksToken(): Promise<string> {
  // Check if running on client-side
  if (typeof window !== 'undefined') {
    throw new Error('Databricks authentication is only available on the server side');
  }

  const method = getAuthMethod();

  switch (method) {
    case 'oauth':
      return getDatabricksOAuthToken();
    case 'cli':
      return getDatabricksCliToken();
    case 'none':
      throw new Error(
        'No Databricks authentication configured. Please set one of:\n' +
        '- DATABRICKS_CLIENT_ID + DATABRICKS_CLIENT_SECRET + DATABRICKS_HOST (OAuth)\n' +
        '- DATABRICKS_CONFIG_PROFILE or DATABRICKS_HOST (CLI auth - run "databricks auth login" first)'
      );
    default:
      throw new Error(`Unknown authentication method: ${method}`);
  }
}

/**
 * Get authentication method description for logging
 */
export function getAuthMethodDescription(): string {
  const method = getAuthMethod();

  switch (method) {
    case 'oauth':
      return 'OAuth (service principal)';
    case 'cli':
      return 'CLI-based OAuth U2M';
    case 'none':
      return 'No authentication configured';
    default:
      return `Unknown method: ${method}`;
  }
}

/**
 * Get the database username based on the authentication method
 * For OAuth (service principal): use PGUSER environment variable
 * For CLI auth (user): use the current user's identity
 */
export async function getDatabaseUsername(): Promise<string> {
  // Check if running on client-side
  if (typeof window !== 'undefined') {
    throw new Error('Database username detection is only available on the server side');
  }

  const method = getAuthMethod();

  switch (method) {
    case 'oauth':
      // For OAuth service principal, use the configured PGUSER
      const pgUser = process.env.PGUSER;
      if (!pgUser) {
        throw new Error('PGUSER environment variable must be set for OAuth authentication');
      }
      return pgUser;

    case 'cli':
      // For CLI auth, use the current user's identity
      console.log(`[CLI Auth] Using user identity for database role`);
      return await getDatabricksUserIdentity();

    case 'none':
      throw new Error('No Databricks authentication configured');

    default:
      throw new Error(`Unknown authentication method: ${method}`);
  }
}

/**
 * Check if any Databricks authentication is available
 */
export function isAuthAvailable(): boolean {
  return getAuthMethod() !== 'none';
}