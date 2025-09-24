#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// OAuth token generation logic
async function getDatabricksToken() {
  const clientId = process.env.DATABRICKS_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET;
  const databricksHost = process.env.DATABRICKS_HOST;

  if (!clientId || !clientSecret || !databricksHost) {
    throw new Error(
      'DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET, and DATABRICKS_HOST must be set for OAuth authentication',
    );
  }

  const tokenUrl = `https://${databricksHost}/oidc/v1/token`;

  console.log('Getting OAuth token for migration...');

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
  console.log(`OAuth token obtained, expires in ${data.expires_in} seconds`);
  return data.access_token;
}

async function runMigration() {
  try {
    // Get OAuth token
    const token = await getDatabricksToken();

    // Set PGPASSWORD environment variable for the migration
    process.env.PGPASSWORD = token;

    // Get schema name (same logic as in schema.ts and drizzle.config.ts)
    const envSchema = process.env.POSTGRES_SCHEMA;
    let schemaName;
    if (envSchema) {
      schemaName = envSchema;
    } else {
      const pgUser = process.env.PGUSER;
      if (pgUser) {
        schemaName = pgUser.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
      } else {
        schemaName = 'public';
      }
    }

    // Create schema if it's not 'public'
    if (schemaName !== 'public') {
      console.log(`Creating schema '${schemaName}' if it doesn't exist...`);

      // Import postgres library that's already used in the project
      const postgres = require('postgres');
      const sql = postgres({
        host: process.env.PGHOST,
        username: process.env.PGUSER,
        password: token,
        database: process.env.PGDATABASE,
        ssl: 'require',
      });

      try {
        await sql`CREATE SCHEMA IF NOT EXISTS ${sql(schemaName)}`;
        console.log(`Schema '${schemaName}' ensured to exist`);
      } catch (schemaError) {
        console.log(`Schema creation notice:`, schemaError.message);
      } finally {
        await sql.end();
      }
    }

    // Get the command from arguments or default to push
    const command = process.argv[2] || 'push';
    const migrationCommand = `npx drizzle-kit ${command}`;

    console.log(`Running: ${migrationCommand}`);

    // Run the drizzle migration
    const { stdout, stderr } = await execAsync(migrationCommand, {
      env: { ...process.env, PGPASSWORD: token }
    });

    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
runMigration();