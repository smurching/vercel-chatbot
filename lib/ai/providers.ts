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
  const url = input.toString();
  const response = await fetch(url, init);

  if (!response.ok) {
    return response;
  }

  const contentType = response.headers.get('content-type');
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
        }))
      })),
      incomplete_details: null,
      usage: {
        input_tokens: 0,
        output_tokens: data.output[0]?.content?.[0]?.text?.length ? Math.ceil(data.output[0].content[0].text.length / 4) : 0,
        total_tokens: data.output[0]?.content?.[0]?.text?.length ? Math.ceil(data.output[0].content[0].text.length / 4) : 0,
      },
      // TODO: extract the "model" param for the request and include it here in the output
      model: "TODO: unknown",
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

// Use the Databricks agent endpoint with responses API
const databricksModel = databricks.responses('agents_ml-bbqiu-annotationsv2');
// Use the Databricks chat endpoint with ChatAgent (not quite chat completions) API, just for testing purposes
// const databricksModel = databricks.chat('agents_ml-samrag-test_chatagent');

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
