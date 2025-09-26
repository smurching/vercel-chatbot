/**
 * Shared database connection utilities for OAuth and traditional authentication
 */
import { getHostUrl, getHostDomain } from '@/lib/databricks-host-utils';

// Token management for both OAuth and PAT-based database credentials
let oauthToken: string | null = null;
let tokenExpiresAt = 0;
let dbCredentialsToken: string | null = null;
let dbCredentialsExpiresAt = 0;

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
  // Set expiration with a 10-minute buffer (OAuth tokens typically expire in 1 hour)
  // We want to refresh well before expiry to avoid any edge cases
  const expiresInSeconds = data.expires_in || 3600; // Default to 1 hour if not provided
  const bufferSeconds = Math.min(600, Math.floor(expiresInSeconds * 0.2)); // 10 minutes or 20% of lifetime, whichever is smaller
  tokenExpiresAt = Date.now() + (expiresInSeconds - bufferSeconds) * 1000;

  console.log(`[OAuth] Token acquired, expires in ${expiresInSeconds}s, will refresh in ${expiresInSeconds - bufferSeconds}s`);

  return accessToken;
}

/**
 * Get a database access token using the database credentials API with PAT authentication
 */
export async function getDatabaseCredentialsToken(instanceName?: string): Promise<string> {
  // Check if we have a valid cached token
  if (dbCredentialsToken && Date.now() < dbCredentialsExpiresAt) {
    return dbCredentialsToken;
  }

  const databricksToken = process.env.DATABRICKS_TOKEN;

  if (!databricksToken) {
    throw new Error(
      'DATABRICKS_TOKEN and DATABRICKS_HOST must be set for PAT-based database authentication',
    );
  }

  // Call the database credentials API
  const credentialsUrl = `${getHostUrl()}/api/2.0/database/credentials`;

  const requestBody = {
    instance_names: instanceName ? [instanceName] : [],
    claims: [
      {
        permission_set: 'READ_WRITE',
        resources: [
          {
            unspecified_resource_name: '*'
          }
        ]
      }
    ],
    request_id: `chatbot-${Date.now()}`
  };

  const response = await fetch(credentialsUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${databricksToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get database credentials: ${response.status} ${errorText}`,
    );
  }

  const data = await response.json();
  const accessToken = data.token;

  if (!accessToken) {
    throw new Error('No access token received from database credentials API response');
  }

  dbCredentialsToken = accessToken;

  // Parse expiration time and set with buffer
  const expirationTime = new Date(data.expiration_time);
  const bufferSeconds = 300; // 5 minute buffer
  dbCredentialsExpiresAt = expirationTime.getTime() - (bufferSeconds * 1000);

  const expiresInSeconds = Math.floor((expirationTime.getTime() - Date.now()) / 1000);
  console.log(`[Database Credentials] Token acquired, expires in ${expiresInSeconds}s, will refresh in ${expiresInSeconds - bufferSeconds}s`);

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
 * with either OAuth (service principal) or PAT-based database credentials
 */
export async function getConnectionUrl(instanceName?: string): Promise<string> {
  // Option 1: Use POSTGRES_URL if provided
  if (process.env.POSTGRES_URL) {
    return process.env.POSTGRES_URL;
  }

  // Option 2: Build URL from individual PG* variables with Databricks authentication
  const pgUser = process.env.PGUSER;
  const pgHost = process.env.PGHOST;
  const pgPort = process.env.PGPORT || '5432';
  const pgDatabase = process.env.PGDATABASE;
  const pgSSLMode = process.env.PGSSLMODE || 'require';

  if (!pgUser || !pgHost || !pgDatabase) {
    throw new Error('Either POSTGRES_URL or PGUSER, PGHOST, and PGDATABASE must be set');
  }

  // Get authentication token - prefer OAuth, fallback to PAT-based database credentials
  let token: string;

  if (shouldUseOAuth()) {
    // Use OAuth (service principal) authentication
    token = await getDatabricksToken();
    console.log('[Connection] Using OAuth (service principal) authentication');
  } else if (shouldUsePATCredentials()) {
    // Use PAT-based database credentials API
    token = await getDatabaseCredentialsToken(instanceName);
    console.log('[Connection] Using PAT-based database credentials authentication');
  } else {
    throw new Error(
      'Either (DATABRICKS_CLIENT_ID + DATABRICKS_CLIENT_SECRET) or DATABRICKS_TOKEN must be set for database authentication'
    );
  }

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
 * Check if we should use PAT-based database credentials
 */
export function shouldUsePATCredentials(): boolean {
  const databricksToken = process.env.DATABRICKS_TOKEN;

  try {
    getHostDomain(); // This will throw if DATABRICKS_HOST is not set
    return !!databricksToken;
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