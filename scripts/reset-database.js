#!/usr/bin/env node

/**
 * Reset Database Script
 *
 * This script drops the custom schema and all its tables, providing a clean slate
 * for the database. Useful for development and testing.
 *
 * Usage: node scripts/reset-database.js
 *
 * WARNING: This will DELETE ALL DATA in the custom schema!
 */

const postgres = require('postgres');

// OAuth token generation function
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

  console.log('Getting OAuth token for database reset...');

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

// Get schema name from environment variable or default to username
function getSchemaName() {
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

async function resetDatabase() {
  const schemaName = getSchemaName();

  if (schemaName === 'public') {
    console.log('⚠️  Warning: Cannot reset public schema. This script only works with custom schemas.');
    console.log('Set POSTGRES_SCHEMA environment variable to specify a custom schema.');
    process.exit(1);
  }

  console.log(`\n⚠️  WARNING: This will DELETE ALL DATA in schema '${schemaName}'!\n`);

  // Check for confirmation flag or prompt for confirmation
  const forceFlag = process.argv.includes('--force');

  if (!forceFlag) {
    console.log('To confirm this action, run the command with --force flag:');
    console.log(`  node scripts/reset-database.js --force\n`);
    process.exit(0);
  }

  try {
    // Get OAuth token
    const token = await getDatabricksToken();

    // Create database connection
    const sql = postgres({
      host: process.env.PGHOST,
      username: process.env.PGUSER,
      password: token,
      database: process.env.PGDATABASE,
      ssl: 'require',
    });

    console.log(`\n🗑️  Dropping schema '${schemaName}'...`);

    // Drop the schema cascade (this will delete all tables, views, etc. in the schema)
    try {
      await sql`DROP SCHEMA IF EXISTS ${sql(schemaName)} CASCADE`;
      console.log(`✅ Schema '${schemaName}' has been dropped successfully.`);
    } catch (error) {
      if (error.code === '3F000') {
        console.log(`ℹ️  Schema '${schemaName}' does not exist.`);
      } else {
        throw error;
      }
    }

    // Check if any test schemas exist and offer to clean them up
    const testSchemas = await sql`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name LIKE 'test_%'
      ORDER BY schema_name
    `;

    if (testSchemas.length > 0) {
      console.log(`\n🧹 Found ${testSchemas.length} test schema(s):`);
      testSchemas.forEach(s => console.log(`   - ${s.schema_name}`));

      if (process.argv.includes('--clean-test')) {
        console.log('\nCleaning up test schemas...');
        for (const testSchema of testSchemas) {
          await sql`DROP SCHEMA IF EXISTS ${sql(testSchema.schema_name)} CASCADE`;
          console.log(`   ✅ Dropped ${testSchema.schema_name}`);
        }
      } else {
        console.log('\nTo also clean up test schemas, run with --clean-test flag:');
        console.log('  node scripts/reset-database.js --force --clean-test');
      }
    }

    await sql.end();

    console.log('\n🎉 Database reset complete!');
    console.log('\nNext steps:');
    console.log('1. Run migrations to recreate the schema and tables:');
    console.log('   node scripts/run-migration-oauth.js');
    console.log('2. Start the development server:');
    console.log('   npm run dev\n');

  } catch (error) {
    console.error('\n❌ Error resetting database:', error.message);
    process.exit(1);
  }
}

// Run the reset
resetDatabase();