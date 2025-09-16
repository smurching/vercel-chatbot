import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';

console.log('providers.ts file loaded');
import { gateway } from '@ai-sdk/gateway';
import { createOpenAI } from '@ai-sdk/openai';
import { isTestEnvironment } from '../constants';

// Custom fetch function to transform Databricks responses to OpenAI format
const databricksFetch: typeof fetch = async (input, init) => {
  console.log('databricksFetch called with URL:', input.toString());

  // Rewrite URL to use the correct Databricks endpoint
  let url = input.toString();
  if (url.includes('/responses/responses')) {
    url = url.replace('/responses/responses', '/serving-endpoints/responses');
  } else if (!url.includes('/serving-endpoints/responses')) {
    // If it's trying to access some other endpoint, redirect to responses
    const baseUrl = url.split('/')[0] + '//' + url.split('/')[2];
    url = `${baseUrl}/serving-endpoints/responses`;
  }

  // Fix the request format for Databricks compatibility
  if (init?.body) {
    try {
      const parsed = JSON.parse(init.body as string);
      console.log('Original request to Databricks:', JSON.stringify(parsed, null, 2));

      // Transform content format for Databricks
      if (parsed.input && Array.isArray(parsed.input)) {
        for (const message of parsed.input) {
          if (message.content && Array.isArray(message.content)) {
            // Convert complex content format to simple string for Databricks
            const textContent = message.content
              .filter((part: any) => part.type === 'input_text' || part.type === 'text')
              .map((part: any) => part.text)
              .join('\n');

            if (textContent) {
              message.content = textContent;
            }
          }
        }
      }

      // Remove or transform tools that Databricks doesn't support
      if (parsed.tools && Array.isArray(parsed.tools)) {
        // Databricks doesn't support the OpenAI tools format, so remove them
        delete parsed.tools;
        delete parsed.tool_choice;
      }

      // Keep streaming enabled - Databricks supports it and UI expects it

      // console.log('Transformed request to Databricks:', JSON.stringify(parsed, null, 2));

      // Create new body with fixed content and tools
      init = {
        ...init,
        body: JSON.stringify(parsed)
      };
    } catch (e) {
      // If parsing fails, continue with original body
    }
  }

  console.log('About to call fetch with URL:', url);
  const response = await fetch(url, init);
  console.log('Fetch completed, response status:', response.status);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));
  console.log('Response body type:', response.body?.constructor.name);

  if (!response.ok) {
    return response;
  }

  const contentType = response.headers.get('content-type');
  console.log('Response content-type:', contentType);

  // If it's a streaming response, inject text-start events as needed
  // Databricks responses API may return 'text/plain' or other content types for streaming
  if (contentType?.includes('text/plain') ||
      contentType?.includes('text/event-stream') ||
      contentType?.includes('application/x-ndjson') ||
      (contentType?.includes('text/') && response.body)) {
    console.log('Processing streaming response, content-type:', contentType);

    if (response.body) {
      console.log('Augmenting streaming response with text-start events');
      // Create augmented stream with text-start events
      const augmentedStream = new ReadableStream({
        async start(controller) {
          try {
            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            const encoder = new TextEncoder();

            let hasInjectedTextStart = false;
            const textPartId = 'text-' + Math.random().toString(36).substr(2, 9);
            let chunkCount = 0;

            while (true) {
              const { done, value } = await reader.read();
              // console.log('Read chunk from stream, value: ', value, 'done: ', done);
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              console.log(`[STREAM] Received chunk ${chunkCount++}:`, JSON.stringify(chunk));

              // Look for data lines in the SSE stream
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                  try {
                    const data = JSON.parse(line.slice(6));

                    // Check if this chunk contains content
                    // Handle both OpenAI format and Databricks responses API format
                    const content = data.choices?.[0]?.delta?.content ||
                                  data.content ||
                                  (data.type === "response.output_text.delta" ? data.delta : null);

                    // If we find content and haven't injected text-start yet, inject it
                    if (!hasInjectedTextStart && content) {
                      console.log('Injecting text-start event before content');
                      const textStartEvent = {
                        type: 'text-start',
                        id: textPartId
                      };
                      const textStartSSE = `data: ${JSON.stringify(textStartEvent)}\n\n`;
                      console.log(`[INJECT] Text-start:`, JSON.stringify(textStartSSE));
                      controller.enqueue(encoder.encode(textStartSSE));
                      hasInjectedTextStart = true;

                      // Now inject the text-delta event for this content
                      const textDeltaEvent = {
                        type: 'text-delta',
                        id: textPartId,
                        delta: content
                      };
                      const textDeltaSSE = `data: ${JSON.stringify(textDeltaEvent)}\n\n`;
                      controller.enqueue(encoder.encode(textDeltaSSE));
                    } else if (content && hasInjectedTextStart) {
                      // Convert subsequent content to text-delta events
                      const textDeltaEvent = {
                        type: 'text-delta',
                        id: textPartId,
                        delta: content
                      };
                      const textDeltaSSE = `data: ${JSON.stringify(textDeltaEvent)}\n\n`;
                      controller.enqueue(encoder.encode(textDeltaSSE));
                    } else if (!content) {
                      // Pass through non-content chunks as-is
                      controller.enqueue(encoder.encode(line + '\n'));
                    }
                  } catch (e) {
                    // If parsing fails, pass through as-is
                    controller.enqueue(encoder.encode(line + '\n'));
                  }
                } else {
                  // Pass through non-data lines as-is
                  controller.enqueue(encoder.encode(line + '\n'));
                }
              }
            }

            // Inject text-done event if we had content
            if (hasInjectedTextStart) {
              console.log('Injecting text-end event');
              const textDoneEvent = {
                type: 'text-end',
                id: textPartId
              };
              const textDoneSSE = `data: ${JSON.stringify(textDoneEvent)}\n\n`;
              controller.enqueue(encoder.encode(textDoneSSE));
            }

            controller.close();
          } catch (error) {
            console.error('Error processing stream:', error);
            controller.error(error);
          }
        }
      });

      // Return response with the augmented stream
      return new Response(augmentedStream, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    return response;
  }

  if (!contentType?.includes('application/json')) {
    return response;
  }

  const data = await response.json();

  // Check if this was a streaming request based on the original request
  const isStreamingRequest = init?.body && init.body.toString().includes('"stream":true');

  // Transform Databricks response format to OpenAI format
  if (data.object === 'response' && data.output && Array.isArray(data.output)) {
    // console.log('Transforming Databricks response:', JSON.stringify(data, null, 2));

    // Extract the text content for the AI SDK
    let textContent = '';
    if (data.output[0]?.content?.[0]?.text) {
      textContent = data.output[0].content[0].text;
    }

    // If streaming was requested, convert to SSE format
    if (isStreamingRequest) {
      // console.log('Converting non-streaming Databricks response to SSE format for streaming request');

      // Create SSE chunks that mimic Vercel AI SDK's expected format
      const chunks = [];
      const textPartId = 'text-' + Math.random().toString(36).substr(2, 9);

      // First: text-start event (required by Vercel AI SDK)
      chunks.push({
        type: 'text-start',
        id: textPartId,
        providerMetadata: undefined
      });

      // Second: text-delta events with the actual content
      if (textContent) {
        // Split content into smaller chunks for more realistic streaming
        const words = textContent.split(' ');
        let accumulatedText = '';

        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const delta = i === 0 ? word : ' ' + word;
          accumulatedText += delta;

          chunks.push({
            type: 'text-delta',
            id: textPartId,
            delta: delta,
            providerMetadata: undefined
          });
        }
      }

      // Final: text-done event
      chunks.push({
        type: 'text-done',
        id: textPartId,
        providerMetadata: undefined
      });

      // Convert to SSE format
      const sseData = chunks.map(chunk =>
        `data: ${JSON.stringify(chunk)}\n\n`
      ).join('') + 'data: [DONE]\n\n';

      return new Response(sseData, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // For non-streaming requests, return the transformed JSON
    const transformedData = {
      model: data.model,
      object: data.object,
      id: data.id,
      created_at: Math.floor(Date.now() / 1000),
      choices: [{
        message: {
          role: 'assistant',
          content: textContent
        },
        finish_reason: 'stop'
      }],
      output: data.output.map((msg: any) => ({
        ...msg,
        content: msg.content.map((content: any) => ({
          ...content,
          annotations: [],
        }))
      })),
      incomplete_details: null,
      usage: {
        input_tokens: 0,
        output_tokens: textContent.length ? Math.ceil(textContent.length / 4) : 0,
        total_tokens: textContent.length ? Math.ceil(textContent.length / 4) : 0,
      }
    };

    // console.log('Transformed response (should have created_at and input_tokens):', JSON.stringify(transformedData, null, 2));

    return new Response(JSON.stringify(transformedData), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  return response;
};

// Create Databricks OpenAI-compatible provider using responses API
const databricks = createOpenAI({
  baseURL: `${process.env.DATABRICKS_HOST || 'https://e2-dogfood.staging.cloud.databricks.com'}`,
  apiKey: process.env.DATABRICKS_TOKEN || '',
  fetch: databricksFetch,
});

// Use the Databricks agent endpoint with responses API
const endpointName = process.env.DATABRICKS_AGENT_ENDPOINT || "fake-endpoint-need-to-fix-this";
console.log("Using endpoint name for Databricks:", endpointName);
console.log("Using Databricks host:", process.env.DATABRICKS_HOST);
console.log("Databricks token available:", !!process.env.DATABRICKS_TOKEN);
const databricksModel = databricks.responses(endpointName);

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
  : customProvider({
      languageModels: {
        'chat-model': databricksModel,
        'chat-model-reasoning': wrapLanguageModel({
          model: databricksModel,
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'title-model': gateway.languageModel('xai/grok-2-1212'),
        'artifact-model': gateway.languageModel('xai/grok-2-1212'),
      },
    });
