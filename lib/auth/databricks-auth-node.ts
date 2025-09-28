/**
 * Node.js-compatible Databricks authentication for build-time scripts
 * This module does NOT import 'server-only' and can be used with tsx
 */

import { spawnWithOutput } from '@/lib/utils/subprocess';
import { getHostUrl } from "../databricks-host-utils";

export function getAuthMethodDescription(): string {
  const method = getAuthMethod();
  switch (method) {
    case 'oauth':
      return 'OAuth service principal';
    case 'cli':
      return 'CLI OAuth U2M';
    default:
      return 'Unknown';
  }
}

export function getAuthMethod(): 'oauth' | 'cli' {
  // Check if OAuth service principal credentials are available
  if (process.env.DATABRICKS_CLIENT_ID && process.env.DATABRICKS_CLIENT_SECRET) {
    return 'oauth';
  }

  // Default to CLI authentication
  return 'cli';
}

export async function getDatabricksToken(): Promise<string> {
  const method = getAuthMethod();

  switch (method) {
    case 'oauth':
      return getDatabricksOAuthToken();
    case 'cli':
      return getDatabricksCliToken();
    default:
      throw new Error(`Unsupported auth method: ${method}`);
  }
}

export async function getDatabaseUsername(): Promise<string> {
  const method = getAuthMethod();

  switch (method) {
    case 'oauth': {
      // For OAuth service principal, use the configured PGUSER
      const pgUser = process.env.PGUSER;
      if (!pgUser) {
        throw new Error('PGUSER environment variable required for OAuth service principal auth');
      }
      return pgUser;
    }
    case 'cli':
      return getDatabricksUserIdentity();
    default:
      throw new Error(`Unsupported auth method: ${method}`);
  }
}

async function getDatabricksOAuthToken(): Promise<string> {
  const clientId = process.env.DATABRICKS_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET;
  const host = getHostUrl();

  if (!clientId || !clientSecret || !host) {
    throw new Error(
      'OAuth service principal authentication requires DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET, and DATABRICKS_HOST environment variables'
    );
  }

  const tokenUrl = `${host.replace(/\/$/, '')}/oidc/v1/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'all-apis',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`OAuth token request failed: ${response.status} ${response.statusText}`);
  }

  const tokenData = await response.json();
  return tokenData.access_token;
}

async function getDatabricksCliToken(): Promise<string> {
  const args = ['auth', 'token'];

  // Add profile if specified
  const configProfile = process.env.DATABRICKS_CONFIG_PROFILE;
  if (configProfile) {
    args.push('--profile', configProfile);
  }

  // Add host if available
  const envHost = process.env.DATABRICKS_HOST;
  if (envHost) {
    const { getHostDomain } = await import('@/lib/databricks-host-utils');
    args.push('--host', getHostDomain(envHost));
  }

  const stdout = await spawnWithOutput('databricks', args, {
    errorMessagePrefix: 'Databricks CLI auth token failed\nMake sure you have run "databricks auth login" first.'
  });

  const tokenData = JSON.parse(stdout);
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    throw new Error('No access_token found in CLI output');
  }

  return accessToken;
}

async function getDatabricksUserIdentity(): Promise<string> {
  const args = ['auth', 'describe', '--output', 'json'];

  // Add profile if specified
  const configProfile = process.env.DATABRICKS_CONFIG_PROFILE;
  if (configProfile) {
    args.push('--profile', configProfile);
  }

  // Add host if available
  const envHost = process.env.DATABRICKS_HOST;
  if (envHost) {
    const { getHostDomain } = await import('@/lib/databricks-host-utils');
    args.push('--host', getHostDomain(envHost));
  }

  const stdout = await spawnWithOutput('databricks', args, {
    errorMessagePrefix: 'Databricks CLI auth describe failed'
  });

  const authData = JSON.parse(stdout);
  const username = authData.username;

  if (!username) {
    throw new Error('No username found in CLI auth describe output');
  }

  return username;
}