/**
 * Shared database connection utilities for OAuth and traditional authentication
 */
import { getHostUrl, getHostDomain } from '@/lib/databricks-host-utils';

// OAuth token management
let oauthToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Get a fresh Databricks OAuth token, with caching
 */
export async function getDatabricksToken(): Promise<string> {
  // Check if we have a valid cached token
  if (oauthToken && Date.now() < tokenExpiresAt) {
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
  // Set expiration with a 5-minute buffer
  tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;

  return accessToken;
}

/**
 * Get the database schema name to use
 * Hardcoded to ai_chatbot for consistency with drizzle-kit generate
 */
export function getSchemaName(): string {
  const schemaName = 'ai_chatbot';
  console.log(`[getSchemaName] Using hardcoded schema: ${schemaName}`);
  return schemaName;
}

/**
 * Build PostgreSQL connection URL, supporting both POSTGRES_URL and PG* variables
 */
export async function getConnectionUrl(): Promise<string> {
  // Option 1: Use POSTGRES_URL if provided
  if (process.env.POSTGRES_URL) {
    return process.env.POSTGRES_URL;
  }

  // Option 2: Build URL from individual PG* variables with OAuth token
  const pgUser = process.env.PGUSER;
  const pgHost = process.env.PGHOST;
  const pgPort = process.env.PGPORT || '5432';
  const pgDatabase = process.env.PGDATABASE;
  const pgSSLMode = process.env.PGSSLMODE || 'require';

  if (!pgUser || !pgHost || !pgDatabase) {
    throw new Error('Either POSTGRES_URL or PGUSER, PGHOST, and PGDATABASE must be set');
  }

  // Get OAuth token for password
  const token = await getDatabricksToken();

  const encodedUser = encodeURIComponent(pgUser);
  const encodedPassword = encodeURIComponent(token);

  return `postgresql://${encodedUser}:${encodedPassword}@${pgHost}:${pgPort}/${pgDatabase}?sslmode=${pgSSLMode}`;
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
 * Check if database storage is available
 */
export function isDatabaseAvailable(): boolean {
  return !!(process.env.PGDATABASE || process.env.POSTGRES_URL);
}