import 'server-only';

/**
 * Legacy authentication module - delegates to consolidated auth module
 * Kept for backward compatibility with existing imports
 */

export {
  type AuthUser,
  type AuthSession,
  type ClientSession,
  type UserType,
  getAuthSession,
  getAuthSessionFromHeaders
} from '@/lib/auth/databricks-auth';