#!/usr/bin/env tsx

import { getHostUrl } from '../lib/databricks-host-utils';

async function getToken() {
  const clientId = process.env.DATABRICKS_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing required env vars: DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET, DATABRICKS_HOST');
    process.exit(1);
  }

  const tokenUrl = `${getHostUrl()}/oidc/v1/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=all-apis',
  });

  const data = await response.json();
  console.log(data.access_token);
}

getToken().catch(console.error);