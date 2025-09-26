const { config } = require('dotenv');
const postgres = require('postgres');

config({ path: '.env.local' });

async function getDatabricksToken() {
  const clientId = process.env.DATABRICKS_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET;
  const databricksHost = process.env.DATABRICKS_HOST;

  if (!clientId || !clientSecret || !databricksHost) {
    throw new Error('DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET, and DATABRICKS_HOST must be set');
  }

  const tokenUrl = `https://${databricksHost}/oidc/v1/token`;

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
  return data.access_token;
}

async function getConnectionUrl() {
  if (process.env.POSTGRES_URL) {
    return process.env.POSTGRES_URL;
  }

  const pgUser = process.env.PGUSER;
  const pgHost = process.env.PGHOST;
  const pgPort = process.env.PGPORT || '5432';
  const pgDatabase = process.env.PGDATABASE;
  const pgSSLMode = process.env.PGSSLMODE || 'require';

  if (!pgUser || !pgHost || !pgDatabase) {
    throw new Error('Either POSTGRES_URL or PGUSER, PGHOST, and PGDATABASE must be set');
  }

  const token = await getDatabricksToken();
  const encodedUser = encodeURIComponent(pgUser);
  const encodedPassword = encodeURIComponent(token);

  return `postgresql://${encodedUser}:${encodedPassword}@${pgHost}:${pgPort}/${pgDatabase}?sslmode=${pgSSLMode}`;
}

async function resetDatabase() {
  console.log('🗑️  Resetting database schema...');

  try {
    const connectionUrl = await getConnectionUrl();
    const sql = postgres(connectionUrl);

    // Drop the ai_chatbot schema cascade
    console.log('Dropping ai_chatbot schema if it exists...');
    await sql`DROP SCHEMA IF EXISTS ai_chatbot CASCADE`;

    console.log('✅ Database reset complete!');
    await sql.end();
  } catch (error) {
    console.error('❌ Failed to reset database:', error);
    process.exit(1);
  }
}

resetDatabase();
