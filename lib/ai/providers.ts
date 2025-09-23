import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { isTestEnvironment } from '../constants';
import type {
  LanguageModelV2,
  LanguageModelV2Middleware,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider';
import { composeDatabricksStreamPartTransformers } from '../databricks-stream-part-transformers';
import {
  applyDatabricksToolCallStreamPartTransform,
  DATABRICKS_TOOL_CALL_ID,
} from '../databricks-tool-calling';
import { applyDatabricksTextPartTransform } from '../databricks-text-parts';

// OAuth token management
let oauthToken: string | null = null;
let tokenExpiresAt = 0;

async function getDatabricksToken(): Promise<string | null> {
  // First, check if we have a PAT token
  if (process.env.DATABRICKS_TOKEN) {
    console.log('Using PAT token from DATABRICKS_TOKEN env var');
    return process.env.DATABRICKS_TOKEN;
  }

  // Otherwise, use OAuth client credentials
  console.log('Using OAuth client credentials for authentication');
  const clientId = process.env.DATABRICKS_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Either DATABRICKS_TOKEN or both DATABRICKS_CLIENT_ID and DATABRICKS_CLIENT_SECRET must be set',
    );
  }

  // Check if we have a valid cached token
  if (oauthToken && Date.now() < tokenExpiresAt) {
    return oauthToken;
  }

  // Mint a new OAuth token
  const tokenUrl = `${workspaceHostname}/oidc/v1/token`;

  console.log('Minting new Databricks OAuth token...');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=all-apis',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get OAuth token: ${response.status} ${errorText}`,
    );
  }

  const data = await response.json();
  oauthToken = data.access_token;
  // Set expiration with a 5-minute buffer
  tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;

  console.log(`OAuth token obtained, expires in ${data.expires_in} seconds`);
  return oauthToken;
}

const workspaceHostname = process.env.DATABRICKS_HOST ? `https://${process.env.DATABRICKS_HOST}` : 'unknown-databricks-workspace-host';
// Custom fetch function to transform Databricks responses to OpenAI format
const databricksFetch: typeof fetch = async (input, init) => {
  const url = input.toString();

  // Log the request being sent to Databricks
  if (init?.body) {
    try {
      const requestBody =
        typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
      console.log(
        'Databricks request:',
        JSON.stringify({
          url,
          method: init.method || 'POST',
          body: requestBody,
        }),
      );
    } catch (e) {
      console.log('Databricks request (raw):', {
        url,
        method: init.method || 'POST',
        body: init.body,
      });
    }
  }

  // Check the authorization header to see what token is being used
  const authHeader = init?.headers
    ? new Headers(init.headers).get('Authorization')
    : null;
  console.log(
    'Authorization header:',
    authHeader ? `${authHeader.substring(0, 20)}...` : 'none',
  );

  const response = await fetch(url, init);

  if (!response.ok) {
    return response;
  }

  const contentType = response.headers.get('content-type');

  // Handle streaming responses (text/event-stream) - add raw logging
  if (contentType?.includes('text/event-stream')) {
    console.log('🔍 Streaming response detected, adding raw chunk logging...');

    const loggingStream = new TransformStream({
      transform(chunk, controller) {
        try {
          const text = new TextDecoder().decode(chunk);
          const lines = text.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              try {
                const eventData = JSON.parse(line.slice(6));
                console.log(
                  '🔍 RAW DATABRICKS CHUNK:',
                  JSON.stringify(eventData, null, 2),
                );

                // Check specifically for function_call_output
                if (eventData.item?.type === 'function_call_output') {
                  console.log(
                    '✅ FOUND function_call_output:',
                    eventData.item.output,
                  );
                }
              } catch (e) {
                console.log('🔍 RAW LINE (unparseable):', line);
              }
            }
          }

          // Pass through unchanged
          controller.enqueue(chunk);
        } catch (error) {
          console.error('Error in logging stream:', error);
          controller.enqueue(chunk);
        }
      },
    });

    return new Response(response.body?.pipeThrough(loggingStream), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  // Handle non-streaming JSON responses
  if (!contentType?.includes('application/json')) {
    return response;
  }

  const data = await response.json();

  // Add fields that are missing from Databricks' ResponsesAgent output chunks
  // TODO: we should be able to fix this upstream in MLflow and add reasonable defaults for
  // these fields (e.g. annotations, usage, etc), or just handle it here/in middleware?
  if (data.object === 'response' && data.output && Array.isArray(data.output)) {
    const transformedData = {
      ...data,
      created_at: Math.floor(Date.now() / 1000),
      output: data.output.map((msg: any) => ({
        ...msg,
        content: msg.content.map((content: any) => ({
          ...content,
          annotations: [],
        })),
      })),
      incomplete_details: null,
      usage: {
        input_tokens: 0,
        output_tokens: data.output[0]?.content?.[0]?.text?.length
          ? Math.ceil(data.output[0].content[0].text.length / 4)
          : 0,
        total_tokens: data.output[0]?.content?.[0]?.text?.length
          ? Math.ceil(data.output[0].content[0].text.length / 4)
          : 0,
      },
      // TODO: extract the "model" param for the request and include it here in the output
      model: 'TODO: unknown',
    };

    return new Response(JSON.stringify(transformedData), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }
  // If not responses agent/endpoint, don't apply special formatting
  // Note: Vercel AI SDK does not know how to render our custom ChatAgent response format,
  // which is chat-completions-like but a bit different (no "choices", etc).
  return new Response(JSON.stringify(data), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};


// Check auth method and set up provider accordingly
let databricks: ReturnType<typeof createOpenAI>;
let oauthProviderCache: ReturnType<typeof createOpenAI> | null = null;
let oauthProviderCacheTime = 0;
const PROVIDER_CACHE_DURATION = 5 * 60 * 1000; // Cache provider for 5 minutes

// Helper function to get or create the Databricks provider with OAuth
async function getOrCreateDatabricksProvider(): Promise<ReturnType<typeof createOpenAI>> {
  // Check if we have a cached provider that's still fresh
  if (oauthProviderCache && Date.now() - oauthProviderCacheTime < PROVIDER_CACHE_DURATION) {
    console.log('Using cached OAuth provider');
    return oauthProviderCache;
  }

  console.log('Creating new OAuth provider');
  const token = await getDatabricksToken();
  if (!token) {
    throw new Error('Failed to get Databricks token');
  }

  // Create provider with fetch that always uses fresh token
  const provider = createOpenAI({
    baseURL: `${workspaceHostname}/serving-endpoints`,
    apiKey: token,
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      // Always get fresh token for each request (will use cache if valid)
      const currentToken = await getDatabricksToken();
      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${currentToken}`);

      return databricksFetch(input, {
        ...init,
        headers,
      });
    },
  });

  oauthProviderCache = provider;
  oauthProviderCacheTime = Date.now();
  return provider;
}

if (typeof window !== 'undefined') {
  console.log('In frontend, using dummy provider');
  databricks = createOpenAI({
    baseURL: `dummy-provider-frontend`,
    apiKey: 'dummy-key',
  });
}
else if (process.env.DATABRICKS_TOKEN) {
  console.log('Using PAT authentication');
  // Use PAT directly
  databricks = createOpenAI({
    baseURL: `${workspaceHostname}/serving-endpoints`,
    apiKey: process.env.DATABRICKS_TOKEN,
    fetch: databricksFetch,
  });
} else if (
  process.env.DATABRICKS_CLIENT_ID &&
  process.env.DATABRICKS_CLIENT_SECRET
) {
  console.log('Using OAuth authentication');

  // Create placeholder that will be replaced by actual provider on first use
  databricks = {} as ReturnType<typeof createOpenAI>;
} else {
  throw new Error(
      'Please set either DATABRICKS_TOKEN for PAT auth or both DATABRICKS_CLIENT_ID and DATABRICKS_CLIENT_SECRET for OAuth',
  );
}

// Use the Databricks serving endpoint from environment variable or fallback to default
// Only check for environment variables on the server side
const isServer = typeof window === 'undefined';

if (isServer) {
  if (!process.env.DATABRICKS_SERVING_ENDPOINT) {
    throw new Error('Please set the DATABRICKS_SERVING_ENDPOINT environment variable to the name of an agent serving endpoint');
  }
}

const servingEndpoint =
  process.env.DATABRICKS_SERVING_ENDPOINT || '';
const databricksChatEndpoint = 'databricks-meta-llama-3-3-70b-instruct';

const databricksMiddleware: LanguageModelV2Middleware = {
  transformParams: async ({ params }) => {
    return {
      ...params,
      // Filter out the DATABRICKS_TOOL_CALL_ID tool
      tools: params.tools?.filter(
        (tool) => tool.name !== DATABRICKS_TOOL_CALL_ID,
      ),
    };
  },
  wrapGenerate: async ({ doGenerate }) => doGenerate(),
  wrapStream: async ({ doStream }) => {
    const { stream, ...rest } = await doStream();
    let lastChunk = null as LanguageModelV2StreamPart | null;
    const transformerStreamParts = composeDatabricksStreamPartTransformers(
      applyDatabricksTextPartTransform,
      applyDatabricksToolCallStreamPartTransform,
    );

    const transformStream = new TransformStream<
      LanguageModelV2StreamPart,
      LanguageModelV2StreamPart
    >({
      transform(chunk, controller) {
        try {
          console.log('databricksMiddleware incoming chunk', chunk);

          // Apply transformation functions to the incoming chunks
          const { out, last } = transformerStreamParts([chunk], lastChunk);
          console.log('databricksMiddleware outgoing chunks', out);

          // Enqueue the transformed chunks
          out.forEach((transformedChunk) => {
            controller.enqueue(transformedChunk);
          });

          // Update the last chunk
          lastChunk = last;
        } catch (error) {
          console.error('Error in databricksMiddleware transform:', error);
          console.error(
            'Stack trace:',
            error instanceof Error ? error.stack : 'No stack available',
          );
          // Continue processing by passing through the original chunk
          controller.enqueue(chunk);
        }
      },
      flush(controller) {
        try {
          // Finally, if there's a dangling text-delta, close it
          if (lastChunk?.type === 'text-delta') {
            controller.enqueue({ type: 'text-end', id: lastChunk.id });
          }
        } catch (error) {
          console.error('Error in databricksMiddleware flush:', error);
        }
      },
    });

    return {
      stream: stream.pipeThrough(transformStream),
      ...rest,
    };
  },
};

// Get the task type of the serving endpoint
const getEndpointDetails = async (servingEndpoint: string) => {
  // Always get fresh token for each request (will use cache if valid)
  const currentToken = await getDatabricksToken();
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${currentToken}`);

  const response = await databricksFetch(
    // `${workspaceHostname}/serving-endpoints/${servingEndpoint}`,
    `${workspaceHostname}/api/2.0/serving-endpoints/${servingEndpoint}`,
    {
      method: 'GET',
      headers,
    },
  );
  const data = await response.json();
  return { task: data.task as string | undefined };
};

// Create a smart provider wrapper that handles OAuth initialization
interface SmartProvider {
  languageModel(id: string): Promise<any> | any;
}

class OAuthAwareProvider implements SmartProvider {
  private modelCache = new Map<string, { model: any; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async languageModel(id: string): Promise<any> {
    const endpointDetails = await getEndpointDetails(servingEndpoint);
    // Check cache first
    const cached = this.modelCache.get(id);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      console.log(`Using cached model for ${id}`);
      return cached.model;
    }

    console.log(`Creating fresh model for ${id}`);

    // Get the OAuth provider
    const provider = await getOrCreateDatabricksProvider();

    let baseModel: LanguageModelV2;
    if (id === 'title-model' || id === 'artifact-model') {
      baseModel = provider.chat(databricksChatEndpoint);
    } else {
      if (endpointDetails.task?.includes('responses')) {
        baseModel = provider.responses(servingEndpoint);
      } else if (endpointDetails.task?.includes('chat')) {
        baseModel = provider.chat(servingEndpoint);
      } else {
        // Fall back to responses
        baseModel = provider.responses(servingEndpoint);
      }
    }

    let finalModel: LanguageModelV2;
    if (id === 'chat-model' || id === 'chat-model-reasoning') {
      finalModel = wrapLanguageModel({
        model: baseModel,
        middleware: [
          extractReasoningMiddleware({ tagName: 'think' }),
          databricksMiddleware,
        ],
      });
    } else {
      finalModel = baseModel;
    }

    // Cache the model
    this.modelCache.set(id, { model: finalModel, timestamp: Date.now() });
    return finalModel;
  }
}

// Create the appropriate provider based on authentication method
let databricksProvider: SmartProvider;

if (process.env.DATABRICKS_CLIENT_ID && process.env.DATABRICKS_CLIENT_SECRET && typeof window === 'undefined') {
  // OAuth path - use the smart provider
  databricksProvider = new OAuthAwareProvider();
} else {
  // PAT auth or frontend - create models immediately
  const databricksModel = databricks.responses(servingEndpoint);
  const databricksChatModel = databricks.chat(databricksChatEndpoint);

  databricksProvider = customProvider({
    languageModels: {
      'chat-model': wrapLanguageModel({
        model: databricksModel,
        middleware: [
          extractReasoningMiddleware({ tagName: 'think' }),
          databricksMiddleware,
        ],
      }),
      'chat-model-reasoning': wrapLanguageModel({
        model: databricksModel,
        middleware: [
          extractReasoningMiddleware({ tagName: 'think' }),
          databricksMiddleware,
        ],
      }),
      'title-model': databricksChatModel,
      'artifact-model': databricksChatModel,
    },
  });
}

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require('./models.mock');
      return customProvider({
        languageModels: {
          'chat-model': chatModel,
          'chat-model-reasoning': reasoningModel,
          'title-model': titleModel,
          'artifact-model': artifactModel,
        },
      });
    })()
  : databricksProvider;
