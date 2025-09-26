/**
 * Database connection utilities using centralized Databricks authentication
 */
import { getDatabricksToken, getAuthMethodDescription, isAuthAvailable } from '@/lib/auth/databricks-auth';


/**
 * Get the database schema name to use
 * Hardcoded to ai_chatbot for consistency with drizzle-kit generate
 */
export function getSchemaName(): string {
  const schemaName = 'ai_chatbot';
  console.log(`[getSchemaName] Using hardcoded schema: ${schemaName}`);
  return schemaName;
}

/**
 * Build PostgreSQL connection URL, supporting both POSTGRES_URL and PG* variables
 * with either OAuth (service principal) or PAT-based database credentials
 */
export async function getConnectionUrl(instanceName?: string): Promise<string> {
  // Option 1: Use POSTGRES_URL if provided
  if (process.env.POSTGRES_URL) {
    return process.env.POSTGRES_URL;
  }

  // Option 2: Build URL from individual PG* variables with Databricks authentication
  const pgUser = process.env.PGUSER;
  const pgHost = process.env.PGHOST;
  const pgPort = process.env.PGPORT || '5432';
  const pgDatabase = process.env.PGDATABASE;
  const pgSSLMode = process.env.PGSSLMODE || 'require';

  if (!pgUser || !pgHost || !pgDatabase) {
    throw new Error('Either POSTGRES_URL or PGUSER, PGHOST, and PGDATABASE must be set');
  }

  // Get authentication token using centralized auth module
  const token = await getDatabricksToken();
  console.log(`[Connection] Using ${getAuthMethodDescription()} authentication`);

  const encodedUser = encodeURIComponent(pgUser);
  const encodedPassword = encodeURIComponent(token);

  return `postgresql://${encodedUser}:${encodedPassword}@${pgHost}:${pgPort}/${pgDatabase}?sslmode=${pgSSLMode}`;
}


/**
 * Check if database storage is available
 */
export function isDatabaseAvailable(): boolean {
  return !!(process.env.PGDATABASE || process.env.POSTGRES_URL);
}