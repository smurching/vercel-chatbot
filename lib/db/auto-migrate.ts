import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { join } from 'path';
import { getConnectionUrl, getSchemaName } from './connection';

config({
  path: '.env.local',
});

// Track migration status to avoid running multiple times
let migrationPromise: Promise<void> | null = null;

/**
 * Automatically run database migrations on startup.
 * This function is idempotent and safe to call multiple times.
 */
export async function autoMigrate(): Promise<void> {
  // If migration is already running, wait for it to complete
  if (migrationPromise) {
    return migrationPromise;
  }

  migrationPromise = (async () => {
    try {
      console.log('🚀 Auto-migrating database...');

      const schemaName = getSchemaName();
      console.log(`🗃️ Using database schema: ${schemaName}`);

      const connectionUrl = await getConnectionUrl();
      const sql = postgres(connectionUrl, {
        max: 1, // Single connection for migration
        idle_timeout: 20,
        connect_timeout: 10,
      });

      // Create schema if it doesn't exist
      console.log(`📁 Creating schema '${schemaName}' if it doesn't exist...`);
      try {
        await sql`CREATE SCHEMA IF NOT EXISTS ${sql(schemaName)}`;
      } catch (error) {
        console.log(error); // Log but don't fail on schema creation notices
      }
      console.log(`✅ Schema '${schemaName}' ensured to exist`);

      // Run migrations
      console.log('⏳ Running migrations...');
      const db = drizzle(sql);

      // Get the migrations directory path
      const migrationsFolder = join(process.cwd(), 'lib', 'db', 'migrations');

      await migrate(db, { migrationsFolder });
      console.log('✅ Migrations completed successfully');

      await sql.end();
    } catch (error) {
      console.error('❌ Auto-migration failed:', error);
      throw error;
    }
  })();

  return migrationPromise;
}

/**
 * Check database connectivity and schema existence.
 * Returns true if database is ready, false otherwise.
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const connectionUrl = await getConnectionUrl();
    const sql = postgres(connectionUrl, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 5,
    });

    const schemaName = getSchemaName();

    // Check if schema exists
    const result = await sql`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = ${schemaName}
    `;

    await sql.end();

    return result.length > 0;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}