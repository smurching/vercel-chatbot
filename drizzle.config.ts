import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({
  path: '.env.local',
});

// Use fixed schema name for out-of-the-box functionality
function getSchemaName(): string {
  // Allow override via environment variable for advanced users
  const envSchema = process.env.POSTGRES_SCHEMA;
  if (envSchema) {
    return envSchema;
  }

  // Default to fixed schema name for out-of-the-box functionality
  return 'ai_chatbot';
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

// Function to get connection URL with OAuth token
async function getConnectionUrl(): Promise<string> {
  // Build URL from individual components
  const pgUser = process.env.PGUSER;
  const pgHost = process.env.PGHOST;
  const pgPort = process.env.PGPORT || '5432';
  const pgDatabase = process.env.PGDATABASE;
  const pgSSLMode = process.env.PGSSLMODE || 'require';

  if (!pgUser || !pgHost || !pgDatabase) {
    throw new Error('Required Postgres environment variables not set: PGUSER, PGHOST, PGDATABASE');
  }

  // Get OAuth token as password
  const pgPassword = await getDatabricksToken();

  const encodedUser = encodeURIComponent(pgUser);
  const encodedPassword = encodeURIComponent(pgPassword);
  return `postgresql://${encodedUser}:${encodedPassword}@${pgHost}:${pgPort}/${pgDatabase}?sslmode=${pgSSLMode}`;
}

const schemaName = getSchemaName();

// Export async function to create config with OAuth token
export async function createConfig() {
  const url = await getConnectionUrl();
  return defineConfig({
    schema: './lib/db/schema.ts',
    out: './lib/db/migrations',
    dialect: 'postgresql',
    dbCredentials: {
      url,
    },
    schemaFilter: schemaName === 'public' ? ['public'] : [schemaName],
    // Enable verbose mode for debugging
    verbose: true,
  });
}

// For compatibility with drizzle-kit CLI, use PG* environment variables
// The password will be provided via PGPASSWORD environment variable from migrate.ts
export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432'),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD, // Will be set by migrate.ts script
    database: process.env.PGDATABASE,
    ssl: process.env.PGSSLMODE !== 'disable',
  },
  schemaFilter: schemaName === 'public' ? ['public'] : [schemaName],
  verbose: true,
});
