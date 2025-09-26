import { config } from 'dotenv';
import { isDatabaseAvailable, getDatabricksToken, getSchemaName, getConnectionUrl } from './connection';
import { spawn } from 'child_process';
import postgres from 'postgres';

// Load environment variables
config({
  path: '.env.local',
});

async function main() {
  console.log('🔄 Running database migration...');

  // Check if database is configured
  if (!isDatabaseAvailable()) {
    console.log('ℹ️  No database configuration found (PGDATABASE or POSTGRES_URL not set)');
    console.log('ℹ️  Skipping database migration - application will use in-memory storage');
    console.log('✅ Migration check completed');
    return;
  }

  console.log('📊 Database configuration detected, running migrations...');

  const schemaName = getSchemaName();
  console.log(`🗃️ Using database schema: ${schemaName}`);

  // Create custom schema if needed
  if (schemaName !== 'public') {
    try {
      const connectionUrl = await getConnectionUrl();
      const schemaConnection = postgres(connectionUrl, { max: 1 });

      console.log(`📁 Creating schema '${schemaName}' if it doesn't exist...`);
      await schemaConnection`CREATE SCHEMA IF NOT EXISTS ${schemaConnection(schemaName)}`;
      console.log(`✅ Schema '${schemaName}' ensured to exist`);

      await schemaConnection.end();
    } catch (error) {
      console.warn(`⚠️ Schema creation warning:`, error.message);
      // Continue with migration even if schema creation had issues
    }
  }

  try {
    // For OAuth with custom schemas, use drizzle-kit push to create tables
    if (schemaName !== 'public' && process.env.DATABRICKS_CLIENT_ID) {
      console.log('🔄 Using drizzle-kit push for OAuth with custom schema...');

      // Get OAuth token for password
      const token = await getDatabricksToken();

      const child = spawn('npx', ['drizzle-kit', 'push', '--force'], {
        env: { ...process.env, PGPASSWORD: token },
        stdio: ['pipe', 'inherit', 'inherit']
      });

      // Auto-confirm with 'y'
      child.stdin.write('y\n');
      child.stdin.end();

      await new Promise((resolve, reject) => {
        child.on('close', (code) => {
          if (code === 0) {
            console.log('✅ drizzle-kit push completed successfully');
            resolve(code);
          } else {
            reject(new Error(`drizzle-kit push exited with code ${code}`));
          }
        });
      });
    } else {
      console.log('🔄 Using auto-migrate for traditional setup...');
      const { autoMigrate } = await import('./auto-migrate');
      await autoMigrate();
    }

    console.log('✅ Database migration completed successfully');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Migration script failed:', error);
  process.exit(1);
});
