import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { isTestEnvironment } from '../constants';
import type {
  LanguageModelV2Middleware,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider';
import { composeDatabricksStreamPartTransformers } from '../databricks-stream-part-transformers';
import {
  applyDatabricksToolCallStreamPartTransform,
  DATABRICKS_TOOL_CALL_ID,
} from '../databricks-tool-calling';
import { applyDatabricksTextPartTransform } from '../databricks-text-parts';

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

// Create Databricks OpenAI-compatible provider using responses API
const databricks = createOpenAI({
  baseURL: `${process.env.DATABRICKS_HOST || 'https://e2-dogfood.staging.cloud.databricks.com'}/serving-endpoints`,
  apiKey: process.env.DATABRICKS_TOKEN || '',
  fetch: databricksFetch,
});

// Use the Databricks serving endpoint from environment variable or fallback to default
const servingEndpoint =
  process.env.DATABRICKS_SERVING_ENDPOINT || 'agents_ml-bbqiu-annotationsv2';
const databricksChatEndpoint = 'databricks-meta-llama-3-3-70b-instruct';
const databricksModel = databricks.responses(servingEndpoint);
const databricksChatModel = databricks.chat(databricksChatEndpoint);

// Use the Databricks chat endpoint with ChatAgent (not quite chat completions) API, just for testing purposes
// const databricksModel = databricks.chat('agents_ml-samrag-test_chatagent');

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

const databricksProvider = customProvider({
  languageModels: {
    'chat-model': wrapLanguageModel({
      model: databricksModel,
      middleware: [databricksMiddleware],
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
