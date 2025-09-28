/**
 * Environment-agnostic CLI utilities for Databricks authentication
 * Can be used in both Next.js server components and Node.js contexts
 */

export interface CliAuthOptions {
  configProfile?: string;
  host?: string;
}

export interface CliTokenResponse {
  access_token: string;
  expires_in?: number;
  token_type?: string;
}

export interface CliAuthDescribeResponse {
  username: string;
  details?: {
    host?: string;
    profile?: string;
  };
}

/**
 * Build CLI command arguments for auth token
 */
export function buildCliTokenArgs(options: CliAuthOptions = {}): string[] {
  const args = ['auth', 'token'];

  if (options.configProfile) {
    args.push('--profile', options.configProfile);
  }

  if (options.host) {
    args.push('--host', options.host);
  }

  return args;
}

/**
 * Build CLI command arguments for auth describe
 */
export function buildCliDescribeArgs(options: CliAuthOptions = {}): string[] {
  const args = ['auth', 'describe', '--output', 'json'];

  if (options.configProfile) {
    args.push('--profile', options.configProfile);
  }

  if (options.host) {
    args.push('--host', options.host);
  }

  return args;
}

/**
 * Parse CLI token response
 */
export function parseCliTokenResponse(stdout: string): CliTokenResponse {
  const tokenData = JSON.parse(stdout);
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    throw new Error('No access_token found in CLI output');
  }

  return {
    access_token: accessToken,
    expires_in: tokenData.expires_in || 3600,
    token_type: tokenData.token_type || 'Bearer',
  };
}

/**
 * Parse CLI auth describe response
 */
export function parseCliDescribeResponse(stdout: string): CliAuthDescribeResponse {
  const authData = JSON.parse(stdout);
  const username = authData.username;

  if (!username) {
    throw new Error('No username found in CLI auth describe output');
  }

  return {
    username,
    details: authData.details,
  };
}

/**
 * Get CLI auth options from environment variables
 */
export function getCliAuthOptionsFromEnv(): CliAuthOptions {
  return {
    configProfile: process.env.DATABRICKS_CONFIG_PROFILE,
    host: process.env.DATABRICKS_HOST,
  };
}

/**
 * Normalize host URL for CLI usage (extract domain)
 */
export function normalizeHostForCli(host: string): string {
  // Remove protocol if present
  let normalized = host.replace(/^https?:\/\//, '');
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');
  return normalized;
}

/**
 * Calculate CLI token expiration with buffer
 */
export function calculateCliTokenExpiration(expiresInSeconds: number, bufferSeconds: number = 300): number {
  return Date.now() + (expiresInSeconds - bufferSeconds) * 1000;
}