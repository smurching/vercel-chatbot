/**
 * Database connection utilities for migration scripts (Node.js compatible)
 */
import { getDatabricksToken, getAuthMethodDescription, getDatabaseUsername } from '@/lib/auth/databricks-auth-node';

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
  const pgHost = process.env.PGHOST;
  const pgPort = process.env.PGPORT || '5432';
  const pgDatabase = process.env.PGDATABASE;
  const pgSSLMode = process.env.PGSSLMODE || 'require';

  if (!pgHost || !pgDatabase) {
    throw new Error('Either POSTGRES_URL or PGHOST and PGDATABASE must be set');
  }

  // Get authentication token and username using centralized auth module
  const token = await getDatabricksToken();
  const username = await getDatabaseUsername();
  console.log(`[Connection] Using ${getAuthMethodDescription()} authentication with user: ${username}`);

  const encodedUser = encodeURIComponent(username);
  const encodedPassword = encodeURIComponent(token);

  return `postgresql://${encodedUser}:${encodedPassword}@${pgHost}:${pgPort}/${pgDatabase}?sslmode=${pgSSLMode}`;
}

/**
 * Check if database storage is available
 */
export function isDatabaseAvailable(): boolean {
  return !!(process.env.PGDATABASE || process.env.POSTGRES_URL);
}