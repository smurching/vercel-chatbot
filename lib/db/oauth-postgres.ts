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

  // Set the search_path to include our custom schema
  const schemaName = getSchemaName();
  if (schemaName !== 'public') {
    try {
      await sql`SET search_path TO ${sql(schemaName)}, public`;
      console.log(`[OAuth Postgres] Set search_path to include schema '${schemaName}'`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[OAuth Postgres] Failed to set search_path for '${schemaName}':`, errorMessage);
      // Don't throw - continue anyway
    }
  }

  return drizzle(sql, { schema });
}

// Note: Runtime migrations have been removed.
// Migrations now run at build time via `npm run build` which calls `tsx lib/db/migrate.ts`

// For migration purposes, export a function to get the connection URL
export async function getConnectionUrlForMigration(): Promise<string> {
  return getConnectionUrl();
}