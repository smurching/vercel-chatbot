import 'server-only';

import { getUserFromHeaders, type User } from '@/lib/db/queries';
import { getHostUrl, getHostDomain } from '@/lib/databricks-host-utils';
import { getDatabricksToken } from '@/lib/auth/databricks-auth';

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

// Cache for SCIM user data in local development - using longer duration for dev
let cachedScimUser: any = null;
let cacheExpiry = 0;

/**
 * Get current user from Databricks SCIM API (for local development)
 */
async function getDatabricksCurrentUser(): Promise<any> {
  // Check cache first
  if (cachedScimUser && Date.now() < cacheExpiry) {
    console.log('[getDatabricksCurrentUser] Using cached SCIM user data (expires in', Math.floor((cacheExpiry - Date.now()) / 1000), 'seconds)');
    return cachedScimUser;
  }

  console.log('[getDatabricksCurrentUser] Cache miss - fetching from SCIM API');

  // Get normalized host (handles both formats: with/without https://)
  const hostUrl = getHostUrl();

  // Use centralized authentication to get token
  const token = await getDatabricksToken();
  const authHeader = `Bearer ${token}`;

  // Call SCIM API to get current user
  const scimUrl = `${hostUrl}/api/2.0/preview/scim/v2/Me`;
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

  // Cache for 30 minutes in development (longer since user won't change)
  cachedScimUser = scimUser;
  cacheExpiry = Date.now() + 30 * 60 * 1000;
  console.log('[getDatabricksCurrentUser] Cached SCIM user data for 30 minutes');

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

      // Get user from headers
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