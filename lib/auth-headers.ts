import 'server-only';

import { getOrCreateUserFromHeaders, type User } from '@/lib/db/queries';

export type UserType = 'guest' | 'regular';

export interface AuthUser {
  id: string;
  email: string;
  type: UserType;
}

export interface AuthSession {
  user: AuthUser;
}

/**
 * Get user from Databricks Apps headers or local development environment
 * This replaces NextAuth for environments where we get user info from HTTP headers
 */
export async function authFromHeaders(request: Request): Promise<AuthSession | null> {
  try {
    const user: User = await getOrCreateUserFromHeaders(request);

    return {
      user: {
        id: user.id,
        email: user.email || '',
        type: 'regular' as UserType,
      }
    };
  } catch (error) {
    console.error('[authFromHeaders] Failed to get user from headers:', error);
    return null;
  }
}

/**
 * Check if we should use header-based auth (Databricks Apps) or fall back to NextAuth
 */
export function shouldUseHeaderAuth(request: Request): boolean {
  // Use header auth if X-Forwarded-User is present (Databricks Apps)
  // or if we're in local development without NextAuth session
  return request.headers.has('X-Forwarded-User') || process.env.NODE_ENV === 'development';
}