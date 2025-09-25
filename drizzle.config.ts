import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({
  path: '.env.local',
});

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

// Function to get connection URL - for migrations we'll use the synchronous approach
function getConnectionUrl(): string {

  // Build URL from individual components
  // Note: For drizzle-kit migrations, you'll need to run a script that sets PGPASSWORD first
  const pgUser = process.env.PGUSER;
  const pgHost = process.env.PGHOST;
  const pgPort = process.env.PGPORT || '5432';
  const pgDatabase = process.env.PGDATABASE;
  const pgSSLMode = process.env.PGSSLMODE || 'require';
  const pgPassword = process.env.PGPASSWORD; // This should be set by the migration script

  if (!pgUser || !pgHost || !pgDatabase || !pgPassword) {
    throw new Error('Required Postgres environment variables not set. For OAuth, run the migration script that sets PGPASSWORD with a fresh token.');
  }

  const encodedUser = encodeURIComponent(pgUser);
  const encodedPassword = encodeURIComponent(pgPassword);
  return `postgresql://${encodedUser}:${encodedPassword}@${pgHost}:${pgPort}/${pgDatabase}?sslmode=${pgSSLMode}`;
}

const schemaName = getSchemaName();

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: getConnectionUrl(),
  },
  schemaFilter: schemaName === 'public' ? ['public'] : [schemaName],
  // Enable verbose mode for debugging
  verbose: true,
});
