import 'server-only';

import { getUserFromHeaders, type User } from '@/lib/db/queries';

export type UserType = 'regular'; // Simplified - no more guest users

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  preferredUsername?: string;
  type: UserType;
}

export interface AuthSession {
  user: AuthUser;
}

// Cache for SCIM user data in local development
let cachedScimUser: any = null;
let cacheExpiry = 0;

/**
 * Get current user from Databricks SCIM API (for local development)
 */
async function getDatabricksCurrentUser(): Promise<any> {
  // Check cache first
  if (cachedScimUser && Date.now() < cacheExpiry) {
    console.log('[getDatabricksCurrentUser] Using cached SCIM user data');
    return cachedScimUser;
  }

  const databricksHost = process.env.DATABRICKS_HOST;
  const databricksToken = process.env.DATABRICKS_TOKEN; // Personal access token for local dev
  const databricksClientId = process.env.DATABRICKS_CLIENT_ID;
  const databricksClientSecret = process.env.DATABRICKS_CLIENT_SECRET;

  if (!databricksHost) {
    throw new Error('DATABRICKS_HOST environment variable is required');
  }

  let authHeader: string;

  // Use OAuth if client credentials are available, otherwise use PAT
  if (databricksClientId && databricksClientSecret) {
    console.log('[getDatabricksCurrentUser] Using OAuth for SCIM API');

    // Get OAuth token
    const tokenUrl = `https://${databricksHost}/oidc/v1/token`;
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${databricksClientId}:${databricksClientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=all-apis',
    });

    if (!response.ok) {
      throw new Error(`Failed to get OAuth token: ${response.status}`);
    }

    const data = await response.json();
    authHeader = `Bearer ${data.access_token}`;
  } else if (databricksToken) {
    console.log('[getDatabricksCurrentUser] Using personal access token for SCIM API');
    authHeader = `Bearer ${databricksToken}`;
  } else {
    throw new Error('Either DATABRICKS_TOKEN or DATABRICKS_CLIENT_ID/SECRET must be set');
  }

  // Call SCIM API to get current user
  const scimUrl = `https://${databricksHost}/api/2.0/preview/scim/v2/Me`;
  console.log('[getDatabricksCurrentUser] Fetching user from SCIM API:', scimUrl);

  const scimResponse = await fetch(scimUrl, {
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
  });

  if (!scimResponse.ok) {
    const errorText = await scimResponse.text();
    throw new Error(`Failed to get SCIM user: ${scimResponse.status} ${errorText}`);
  }

  const scimUser = await scimResponse.json();
  console.log('[getDatabricksCurrentUser] SCIM user retrieved:', {
    id: scimUser.id,
    userName: scimUser.userName,
    displayName: scimUser.displayName,
    emails: scimUser.emails,
  });

  // Cache for 5 minutes
  cachedScimUser = scimUser;
  cacheExpiry = Date.now() + 5 * 60 * 1000;

  return scimUser;
}

/**
 * Main authentication function for all environments
 */
export async function getAuthSession(request?: Request): Promise<AuthSession | null> {
  try {
    // Check for Databricks Apps headers (production)
    if (request?.headers.get('X-Forwarded-User')) {
      console.log('[getAuthSession] Using Databricks Apps headers');

      const forwardedUser = request.headers.get('X-Forwarded-User');
      const forwardedEmail = request.headers.get('X-Forwarded-Email');
      const forwardedPreferredUsername = request.headers.get('X-Forwarded-Preferred-Username');

      // Get or create user in database
      const user = await getUserFromHeaders(request);

      return {
        user: {
          id: user.id,
          email: user.email || forwardedEmail || '',
          name: forwardedPreferredUsername || forwardedUser || undefined,
          preferredUsername: forwardedPreferredUsername || undefined,
          type: 'regular',
        }
      };
    }

    // Local development - use SCIM API
    console.log('[getAuthSession] Using SCIM API for local development');

    const scimUser = await getDatabricksCurrentUser();

    // Extract email from SCIM response
    const primaryEmail = scimUser.emails?.find((e: any) => e.primary)?.value ||
                        scimUser.emails?.[0]?.value ||
                        `${scimUser.userName}@databricks.com`;

    // Create mock request for user creation
    const mockRequest = {
      headers: {
        get: (name: string) => {
          if (name === 'X-Forwarded-User') return scimUser.id;
          if (name === 'X-Forwarded-Email') return primaryEmail;
          if (name === 'X-Forwarded-Preferred-Username') return scimUser.userName;
          return null;
        },
        has: (name: string) => {
          return ['X-Forwarded-User', 'X-Forwarded-Email', 'X-Forwarded-Preferred-Username'].includes(name);
        }
      }
    } as Request;

    // Get or create user in database
    const user = await getUserFromHeaders(mockRequest);

    return {
      user: {
        id: user.id,
        email: user.email || primaryEmail,
        name: scimUser.displayName || scimUser.userName,
        preferredUsername: scimUser.userName,
        type: 'regular',
      }
    };
  } catch (error) {
    console.error('[getAuthSession] Failed to get session:', error);
    return null;
  }
}

/**
 * Get auth session for Next.js page components (using headers from next/headers)
 */
export async function getAuthSessionFromHeaders(headersList: Headers): Promise<AuthSession | null> {
  // Create a mock request from Next.js headers
  const mockRequest = {
    headers: headersList
  } as Request;

  return getAuthSession(mockRequest);
}

/**
 * Simple session context for client components
 * Note: This will need to be fetched from an API endpoint since we can't use SCIM directly from browser
 */
export interface ClientSession {
  user: {
    email: string;
    name?: string;
    preferredUsername?: string;
  } | null;
}