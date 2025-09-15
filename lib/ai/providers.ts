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

  // Fix the content format for Databricks compatibility
  if (init?.body) {
    try {
      const parsed = JSON.parse(init.body as string);

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

        // Create new body with fixed content
        init = {
          ...init,
          body: JSON.stringify(parsed)
        };
      }
    } catch (e) {
      // If parsing fails, continue with original body
    }
  }

  const response = await fetch(url, init);

  if (!response.ok) {
    return response;
  }

  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return response;
  }

  const data = await response.json();

  // Transform Databricks response format to OpenAI responses format
  if (data.object === 'response' && data.output && Array.isArray(data.output)) {
    const transformedData = {
      ...data,
      created_at: Math.floor(Date.now() / 1000),
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
        output_tokens: data.output[0]?.content?.[0]?.text?.length ? Math.ceil(data.output[0].content[0].text.length / 4) : 0,
        total_tokens: data.output[0]?.content?.[0]?.text?.length ? Math.ceil(data.output[0].content[0].text.length / 4) : 0,
      }
    };

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
        'title-model': databricksModel,
        'artifact-model': databricksModel,
      },
    });
