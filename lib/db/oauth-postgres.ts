import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { getConnectionUrl, getSchemaName } from './connection';


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

    const connectionUrl = await getConnectionUrl();
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[OAuth Postgres] Failed to create schema or set search_path for '${schemaName}':`, errorMessage);
      // Don't throw - maybe it already exists or we don't have permissions
    }
  }

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[OAuth Postgres] Error checking tables, attempting to run migrations:`, errorMessage);
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[OAuth Postgres] Migration failed:`, errorMessage);
    // Don't throw - let the app continue and fail on actual DB operations if needed
  }
}

// For migration purposes, export a function to get the connection URL
export async function getConnectionUrlForMigration(): Promise<string> {
  return getConnectionUrl();
}