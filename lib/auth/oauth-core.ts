/**
 * Environment-agnostic OAuth utilities for Databricks authentication
 * Can be used in both Next.js server components and Node.js contexts
 */

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
  hostUrl: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  expires_in?: number;
  token_type?: string;
}

/**
 * Validate OAuth credentials
 */
export function validateOAuthCredentials(credentials: Partial<OAuthCredentials>): OAuthCredentials {
  const { clientId, clientSecret, hostUrl } = credentials;

  if (!clientId || !clientSecret || !hostUrl) {
    throw new Error(
      'OAuth service principal authentication requires DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET, and DATABRICKS_HOST environment variables'
    );
  }

  return { clientId, clientSecret, hostUrl };
}

/**
 * Build OAuth token request URL
 */
export function buildTokenUrl(hostUrl: string): string {
  return `${hostUrl.replace(/\/$/, '')}/oidc/v1/token`;
}

/**
 * Build OAuth token request headers
 */
export function buildOAuthHeaders(clientId: string, clientSecret: string): Record<string, string> {
  return {
    Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

/**
 * Build OAuth token request body
 */
export function buildOAuthBody(): string {
  return 'grant_type=client_credentials&scope=all-apis';
}

/**
 * Build OAuth token request body (URLSearchParams version)
 */
export function buildOAuthBodyParams(clientId: string, clientSecret: string): URLSearchParams {
  return new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'all-apis',
    client_id: clientId,
    client_secret: clientSecret,
  });
}

/**
 * Parse OAuth token response
 */
export function parseOAuthResponse(data: any): OAuthTokenResponse {
  const accessToken = data.access_token;

  if (!accessToken) {
    throw new Error('No access token received from OAuth response');
  }

  return {
    access_token: accessToken,
    expires_in: data.expires_in || 3600,
    token_type: data.token_type || 'Bearer',
  };
}

/**
 * Calculate token expiration time with buffer
 */
export function calculateTokenExpiration(expiresInSeconds: number, bufferFactor: number = 0.2, minBufferSeconds: number = 300): number {
  const bufferSeconds = Math.min(minBufferSeconds, Math.floor(expiresInSeconds * bufferFactor));
  return Date.now() + (expiresInSeconds - bufferSeconds) * 1000;
}

/**
 * Fetch OAuth token using the provided credentials and fetch implementation
 */
export async function fetchOAuthToken(
  credentials: OAuthCredentials,
  fetchFn: typeof fetch = fetch
): Promise<OAuthTokenResponse> {
  const tokenUrl = buildTokenUrl(credentials.hostUrl);
  const headers = buildOAuthHeaders(credentials.clientId, credentials.clientSecret);
  const body = buildOAuthBody();

  const response = await fetchFn(tokenUrl, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get OAuth token: ${response.status} ${errorText}`
    );
  }

  const data = await response.json();
  return parseOAuthResponse(data);
}