'use server';

import { getDatabricksServerProvider } from './providers-server';

/**
 * Server action wrapper for getting the Databricks provider
 * This is needed to properly handle the 'use server' directive
 */
export async function getServerProviderAction() {
  return getDatabricksServerProvider();
}