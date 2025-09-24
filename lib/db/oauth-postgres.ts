import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// OAuth token management for Postgres
let oauthToken: string | null = null;
let tokenExpiresAt = 0;

async function getDatabricksPostgresToken(): Promise<string> {
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

  console.log('Minting new Databricks OAuth token for Postgres...');

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

  console.log(`OAuth token obtained for Postgres, expires in ${data.expires_in} seconds`);
  return oauthToken;
}

// Create a function to build the connection URL with fresh token
async function getPostgresConnectionUrl(): Promise<string> {
  const token = await getDatabricksPostgresToken();

  const pgUser = process.env.PGUSER;
  const pgHost = process.env.PGHOST;
  const pgPort = process.env.PGPORT || '5432';
  const pgDatabase = process.env.PGDATABASE;
  const pgSSLMode = process.env.PGSSLMODE || 'require';

  if (!pgUser || !pgHost || !pgDatabase) {
    throw new Error('PGUSER, PGHOST, and PGDATABASE must be set');
  }

  // URL encode the username (email)
  const encodedUser = encodeURIComponent(pgUser);

  return `postgresql://${encodedUser}:${token}@${pgHost}:${pgPort}/${pgDatabase}?sslmode=${pgSSLMode}`;
}

// Connection pool management
let sqlConnection: postgres.Sql | null = null;
let connectionExpiresAt = 0;
const CONNECTION_LIFETIME = 4 * 60 * 1000; // Refresh connection every 4 minutes (before token expires)

async function getConnection(): Promise<postgres.Sql> {
  // Check if we need a new connection (expired token or no connection)
  if (!sqlConnection || Date.now() > connectionExpiresAt) {
    // Close existing connection if any
    if (sqlConnection) {
      await sqlConnection.end();
      sqlConnection = null;
    }

    const connectionUrl = await getPostgresConnectionUrl();
    sqlConnection = postgres(connectionUrl, {
      max: 10, // connection pool size
      idle_timeout: 20,
      connect_timeout: 10,
    });

    // Set connection expiration
    connectionExpiresAt = Date.now() + CONNECTION_LIFETIME;
    console.log('Created new Postgres connection with OAuth token');
  }

  return sqlConnection;
}

// Get schema name from environment variable or default to username
function getSchemaName(): string {
  const envSchema = process.env.POSTGRES_SCHEMA;
  if (envSchema) {
    return envSchema;
  }

  // Default to postgres username if available
  const pgUser = process.env.PGUSER;
  if (pgUser) {
    // Remove the @domain part if it's an email
    return pgUser.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
  }

  return 'public';
}

// Export a function to get the Drizzle instance with fresh connection
export async function getDb() {
  const sql = await getConnection();

  // Create schema if it doesn't exist and it's not 'public'
  const schemaName = getSchemaName();
  if (schemaName !== 'public') {
    try {
      await sql`CREATE SCHEMA IF NOT EXISTS ${sql(schemaName)}`;
      console.log(`[OAuth Postgres] Ensured schema '${schemaName}' exists`);

      // Set the search_path to include our custom schema
      await sql`SET search_path TO ${sql(schemaName)}, public`;
      console.log(`[OAuth Postgres] Set search_path to include schema '${schemaName}'`);
    } catch (error) {
      console.error(`[OAuth Postgres] Failed to create schema or set search_path for '${schemaName}':`, error);
      // Don't throw - maybe it already exists or we don't have permissions
    }
  }

  // Note: Automatic migrations are disabled due to drizzle-kit issues with custom schemas
  // Run `node scripts/run-migration-oauth.js` manually to set up tables

  return drizzle(sql, { schema });
}

// Function to ensure all required tables exist
async function ensureTablesExist(sql: postgres.Sql, schemaName: string): Promise<boolean> {
  try {
    // Check if the main tables exist
    const result = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = ${schemaName}
      AND table_name IN ('User', 'Chat', 'Message_v2', 'Document', 'Suggestion', 'Stream', 'Vote_v2')
    `;

    // If we have fewer than 7 required tables, run migrations
    if (result.length < 7) {
      console.log(`[OAuth Postgres] Found ${result.length}/7 required tables in schema '${schemaName}'. Running migrations...`);
      await runMigrations();
      return true;
    } else {
      console.log(`[OAuth Postgres] All required tables exist in schema '${schemaName}'`);
      return false;
    }
  } catch (error) {
    console.error(`[OAuth Postgres] Error checking tables, attempting to run migrations:`, error.message);
    await runMigrations();
    return true;
  }
}

// Function to run migrations programmatically
async function runMigrations() {
  try {
    console.log(`[OAuth Postgres] Running database migrations using our migration script...`);

    // Import and run our working migration script directly
    const { execSync } = await import('child_process');

    execSync('node scripts/run-migration-oauth.js', {
      stdio: 'inherit',
      env: process.env
    });

    console.log(`[OAuth Postgres] Migrations completed successfully`);
  } catch (error) {
    console.error(`[OAuth Postgres] Migration failed:`, error.message);
    // Don't throw - let the app continue and fail on actual DB operations if needed
  }
}

// For migration purposes, export a function to get the connection URL
export async function getConnectionUrlForMigration(): Promise<string> {
  return getPostgresConnectionUrl();
}