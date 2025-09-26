/**
 * Shared database connection utilities for OAuth and traditional authentication
 */

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
  const databricksHost = process.env.DATABRICKS_HOST;

  if (!clientId || !clientSecret || !databricksHost) {
    throw new Error(
      'DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET, and DATABRICKS_HOST must be set for OAuth authentication',
    );
  }

  // Mint a new OAuth token
  const tokenUrl = `https://${databricksHost}/oidc/v1/token`;

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
  oauthToken = data.access_token;
  // Set expiration with a 5-minute buffer
  tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;

  return oauthToken;
}

/**
 * Get the database schema name (with fallback to default)
 */
export function getSchemaName(): string {
  // Allow override via environment variable for advanced users
  const envSchema = process.env.POSTGRES_SCHEMA;
  if (envSchema) {
    console.log(`[getSchemaName] Using env schema: ${envSchema}`);
    return envSchema;
  }

  // Default to fixed schema name for out-of-the-box functionality
  console.log('[getSchemaName] Using default schema: ai_chatbot');
  return 'ai_chatbot';
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
  const databricksHost = process.env.DATABRICKS_HOST;

  return !!(clientId && clientSecret && databricksHost);
}