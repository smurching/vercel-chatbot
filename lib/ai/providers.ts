import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { createOpenAI } from '@ai-sdk/openai';
import { isTestEnvironment } from '../constants';
import { createDatabricksProvider } from './databricks-provider';

// Create Databricks provider
const databricks = createDatabricksProvider({
  baseURL: `${process.env.DATABRICKS_HOST || 'https://e2-dogfood.staging.cloud.databricks.com'}/serving-endpoints/responses`,
  apiKey: process.env.DATABRICKS_TOKEN || '',
});

// Use the Databricks agent endpoint
const databricksModel = databricks('ka-1e3e7f9e-endpoint');

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
