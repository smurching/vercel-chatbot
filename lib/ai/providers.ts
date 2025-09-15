import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { createOpenAI } from '@ai-sdk/openai';
import { isTestEnvironment } from '../constants';

// Custom fetch function to transform Databricks responses to OpenAI format
const databricksFetch: typeof fetch = async (input, init) => {
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

      console.log('Transformed request to Databricks:', JSON.stringify(parsed, null, 2));

      // Create new body with fixed content and tools
      init = {
        ...init,
        body: JSON.stringify(parsed)
      };
    } catch (e) {
      // If parsing fails, continue with original body
    }
  }

  const response = await fetch(url, init);

  if (!response.ok) {
    return response;
  }

  const contentType = response.headers.get('content-type');

  // If it's a streaming response, return as-is
  if (contentType?.includes('text/plain') || contentType?.includes('text/event-stream')) {
    console.log('Returning streaming response as-is');
    return response;
  }

  if (!contentType?.includes('application/json')) {
    return response;
  }

  const data = await response.json();

  // Transform Databricks response format to OpenAI format
  if (data.object === 'response' && data.output && Array.isArray(data.output)) {
    console.log('Transforming Databricks response:', JSON.stringify(data, null, 2));

    // Extract the text content for the AI SDK
    let textContent = '';
    if (data.output[0]?.content?.[0]?.text) {
      textContent = data.output[0].content[0].text;
    }

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

    console.log('Transformed response (should have created_at and input_tokens):', JSON.stringify(transformedData, null, 2));

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
const databricksModel = databricks.responses('ka-1e3e7f9e-endpoint');

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
