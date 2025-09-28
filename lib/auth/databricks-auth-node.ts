/**
 * Node.js-compatible Databricks authentication for build-time scripts
 * This module does NOT import 'server-only' and can be used with tsx
 */

import { spawnWithOutput } from '@/lib/utils/subprocess';
import { getHostUrl } from "../databricks-host-utils";
import { validateOAuthCredentials, buildOAuthBodyParams } from './oauth-core';
import { buildCliTokenArgs, buildCliDescribeArgs, parseCliTokenResponse, parseCliDescribeResponse, getCliAuthOptionsFromEnv, normalizeHostForCli } from './cli-core';

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
  const credentials = validateOAuthCredentials({
    clientId: process.env.DATABRICKS_CLIENT_ID,
    clientSecret: process.env.DATABRICKS_CLIENT_SECRET,
    hostUrl: getHostUrl(),
  });

  const tokenUrl = `${credentials.hostUrl.replace(/\/$/, '')}/oidc/v1/token`;
  const body = buildOAuthBodyParams(credentials.clientId, credentials.clientSecret);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`OAuth token request failed: ${response.status} ${response.statusText}`);
  }

  const tokenData = await response.json();
  return tokenData.access_token;
}

async function getDatabricksCliToken(): Promise<string> {
  const cliOptions = getCliAuthOptionsFromEnv();

  if (cliOptions.host) {
    const { getHostDomain } = await import('@/lib/databricks-host-utils');
    cliOptions.host = getHostDomain(cliOptions.host);
  }

  const args = buildCliTokenArgs(cliOptions);

  const stdout = await spawnWithOutput('databricks', args, {
    errorMessagePrefix: 'Databricks CLI auth token failed\nMake sure you have run "databricks auth login" first.'
  });

  const tokenResponse = parseCliTokenResponse(stdout);
  return tokenResponse.access_token;
}

async function getDatabricksUserIdentity(): Promise<string> {
  const cliOptions = getCliAuthOptionsFromEnv();

  if (cliOptions.host) {
    const { getHostDomain } = await import('@/lib/databricks-host-utils');
    cliOptions.host = getHostDomain(cliOptions.host);
  }

  const args = buildCliDescribeArgs(cliOptions);

  const stdout = await spawnWithOutput('databricks', args, {
    errorMessagePrefix: 'Databricks CLI auth describe failed'
  });

  const response = parseCliDescribeResponse(stdout);
  return response.username;
}