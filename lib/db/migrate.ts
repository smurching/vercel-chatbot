import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres';
import { execSync } from 'child_process';

config({
  path: '.env.local',
});

// OAuth token generation for Databricks
async function getDatabricksToken(): Promise<string> {
  const clientId = process.env.DATABRICKS_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET;
  const databricksHost = process.env.DATABRICKS_HOST;

  if (!clientId || !clientSecret || !databricksHost) {
    throw new Error(
        'DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET, and DATABRICKS_HOST must be set for OAuth authentication',
    );
  }

  const tokenUrl = `https://${databricksHost}/oidc/v1/token`;

  console.log('🔐 Getting OAuth token for migration...');

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
    throw new Error(`Failed to get OAuth token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log(`✅ OAuth token obtained, expires in ${data.expires_in} seconds`);
  return data.access_token;
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

// Build connection URL for OAuth or traditional connection
async function getConnectionUrl(): Promise<string> {
  // If POSTGRES_URL is set (traditional approach)
  if (process.env.POSTGRES_URL) {
    return process.env.POSTGRES_URL;
  }

  // OAuth approach - build URL from components
  const pgUser = process.env.PGUSER;
  const pgHost = process.env.PGHOST;
  const pgPort = process.env.PGPORT || '5432';
  const pgDatabase = process.env.PGDATABASE;
  const pgSSLMode = process.env.PGSSLMODE || 'require';

  if (!pgUser || !pgHost || !pgDatabase) {
    throw new Error('PGUSER, PGHOST, and PGDATABASE must be set for OAuth authentication');
  }

  // Get OAuth token for password
  const token = await getDatabricksToken();

  const encodedUser = encodeURIComponent(pgUser);
  const encodedPassword = encodeURIComponent(token);

  return `postgresql://${encodedUser}:${encodedPassword}@${pgHost}:${pgPort}/${pgDatabase}?sslmode=${pgSSLMode}`;
}

const runMigrate = async () => {
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

  // Create OAuth-authenticated connection
  const connectionUrl = await getConnectionUrl();
  const connection = postgres(connectionUrl, { max: 1 });
  const db = drizzle(connection);

  console.log('⏳ Running migrations...');

  const start = Date.now();

  await migrate(db, { migrationsFolder: './lib/db/migrations' });
  const end = Date.now();

  console.log('✅ Migrations completed in', end - start, 'ms');
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error('❌ Migration failed');
  console.error(err);
  process.exit(1);
});
