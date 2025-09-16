// Integration test using Vercel AI SDK directly with our databricksFetch
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

// Copy of our databricksFetch function from providers.ts
const databricksFetch = async (input, init) => {
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
      const parsed = JSON.parse(init.body);
      console.log('Original request to Databricks:', JSON.stringify(parsed, null, 2));

      // Transform content format for Databricks
      if (parsed.input && Array.isArray(parsed.input)) {
        for (const message of parsed.input) {
          if (message.content && Array.isArray(message.content)) {
            // Convert complex content format to simple string for Databricks
            const textContent = message.content
              .filter(part => part.type === 'input_text' || part.type === 'text')
              .map(part => part.text || part.input_text || part.content || '')
              .join('');
            message.content = textContent;
          }
        }
      }

      // Transform messages format
      if (parsed.messages && Array.isArray(parsed.messages)) {
        for (const message of parsed.messages) {
          if (message.content && Array.isArray(message.content)) {
            const textContent = message.content
              .filter(part => part.type === 'input_text' || part.type === 'text')
              .map(part => part.text || part.input_text || part.content || '')
              .join('');
            message.content = textContent;
          }
        }
        // Transform messages to input format for Databricks
        parsed.input = parsed.messages;
        delete parsed.messages;
      }

      // Remove OpenAI-specific fields that Databricks doesn't support
      delete parsed.tools;
      delete parsed.tool_choice;

      init.body = JSON.stringify(parsed);
      console.log('Transformed request for Databricks:', JSON.stringify(parsed, null, 2));
    } catch (error) {
      console.log('Failed to parse/transform request body:', error);
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
  if (contentType?.includes('text/plain') ||
      contentType?.includes('text/event-stream') ||
      contentType?.includes('application/x-ndjson') ||
      (contentType?.includes('text/') && response.body)) {
    console.log('Processing streaming response, content-type:', contentType);

    if (response.body) {
      console.log('Augmenting streaming response with text-start events');

      // Create a tee for debugging
      const [debugStream, processingStream] = response.body.tee();

      // Log original stream in background
      (async () => {
        const reader = debugStream.getReader();
        const decoder = new TextDecoder();
        let chunkIndex = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          console.log(`[ORIG] Chunk ${chunkIndex++}:`, JSON.stringify(chunk));
        }
        console.log('[ORIG] Stream complete');
      })();

      // Create augmented stream with text-start events
      const augmentedStream = new ReadableStream({
        async start(controller) {
          try {
            const reader = processingStream.getReader();
            const decoder = new TextDecoder();
            const encoder = new TextEncoder();

            let hasInjectedTextStart = false;
            const textPartId = 'text-' + Math.random().toString(36).substr(2, 9);
            let augmentedChunkIndex = 0;

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });

              // Look for data lines in the SSE stream
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                  try {
                    const data = JSON.parse(line.slice(6));

                    // Check if this chunk contains content
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
                      const textStartBytes = encoder.encode(textStartSSE);
                      console.log(`[AUG] Chunk ${augmentedChunkIndex++} (text-start):`, JSON.stringify(textStartSSE));
                      controller.enqueue(textStartBytes);
                      hasInjectedTextStart = true;

                      // Now inject the text-delta event for this content
                      const textDeltaEvent = {
                        type: 'text-delta',
                        id: textPartId,
                        delta: content
                      };
                      const textDeltaSSE = `data: ${JSON.stringify(textDeltaEvent)}\n\n`;
                      const textDeltaBytes = encoder.encode(textDeltaSSE);
                      console.log(`[AUG] Chunk ${augmentedChunkIndex++} (text-delta):`, JSON.stringify(textDeltaSSE));
                      controller.enqueue(textDeltaBytes);
                    } else if (content && hasInjectedTextStart) {
                      // Convert subsequent content to text-delta events
                      const textDeltaEvent = {
                        type: 'text-delta',
                        id: textPartId,
                        delta: content
                      };
                      const textDeltaSSE = `data: ${JSON.stringify(textDeltaEvent)}\n\n`;
                      const textDeltaBytes = encoder.encode(textDeltaSSE);
                      console.log(`[AUG] Chunk ${augmentedChunkIndex++} (text-delta):`, JSON.stringify(textDeltaSSE));
                      controller.enqueue(textDeltaBytes);
                    } else if (!content) {
                      // Pass through non-content chunks as-is
                      const passThruBytes = encoder.encode(line + '\n');
                      console.log(`[AUG] Chunk ${augmentedChunkIndex++} (passthru):`, JSON.stringify(line + '\n'));
                      controller.enqueue(passThruBytes);
                    }
                  } catch (e) {
                    // If parsing fails, pass through as-is
                    const errorBytes = encoder.encode(line + '\n');
                    console.log(`[AUG] Chunk ${augmentedChunkIndex++} (error-passthru):`, JSON.stringify(line + '\n'), 'Error:', e.message);
                    controller.enqueue(errorBytes);
                  }
                } else {
                  // Pass through non-data lines as-is
                  const nonDataBytes = encoder.encode(line + '\n');
                  console.log(`[AUG] Chunk ${augmentedChunkIndex++} (non-data):`, JSON.stringify(line + '\n'));
                  controller.enqueue(nonDataBytes);
                }
              }
            }

            // Inject text-done event if we had content
            if (hasInjectedTextStart) {
              console.log('Injecting text-done event');
              const textDoneEvent = {
                type: 'text-end',
                id: textPartId
              };
              const textDoneSSE = `data: ${JSON.stringify(textDoneEvent)}\n\n`;
              const textDoneBytes = encoder.encode(textDoneSSE);
              console.log(`[AUG] Chunk ${augmentedChunkIndex++} (text-done):`, JSON.stringify(textDoneSSE));
              controller.enqueue(textDoneBytes);
            }

            console.log('[AUG] Closing controller');
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

  // For non-streaming responses, transform the JSON
  if (!contentType?.includes('application/json')) {
    return response;
  }

  try {
    const data = await response.json();
    console.log('Original JSON response:', JSON.stringify(data, null, 2));

    // Transform response to OpenAI format if needed
    let transformedData = data;

    return new Response(JSON.stringify(transformedData), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    console.log('Failed to parse response as JSON:', error);
    return response;
  }
};

async function testAISDKIntegration() {
  console.log('🧪 Testing AI SDK integration with Databricks...\n');

  // Create Databricks OpenAI-compatible provider
  const databricks = createOpenAI({
    baseURL: `${process.env.DATABRICKS_HOST || 'https://e2-dogfood.staging.cloud.databricks.com'}`,
    apiKey: process.env.DATABRICKS_TOKEN || '',
    fetch: databricksFetch,
  });

  // Use the responses API
  const endpointName = process.env.DATABRICKS_AGENT_ENDPOINT || "fake-endpoint-need-to-fix-this";
  console.log("Using endpoint name for Databricks:", endpointName);
  const databricksModel = databricks.responses(endpointName);

  try {
    console.log('Starting streamText call...\n');

    const result = streamText({
      model: databricksModel,
      messages: [
        { role: 'user', content: 'Say hello and count to 3.' }
      ],
    });

    console.log('\n📡 Processing stream...\n');

    // Process the text stream
    let fullText = '';
    for await (const textPart of result.textStream) {
      console.log('📝 Text chunk:', JSON.stringify(textPart));
      fullText += textPart;
    }

    console.log('\n✅ Stream completed!');
    console.log('📄 Full text:', fullText);

    const usage = await result.usage;
    const finishReason = await result.finishReason;

    console.log('📊 Usage:', usage);
    console.log('🏁 Finish reason:', finishReason);

  } catch (error) {
    console.error('❌ Error in AI SDK integration test:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testAISDKIntegration();