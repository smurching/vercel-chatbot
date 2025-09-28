/**
 * Client-side only provider that doesn't import any server code
 * This file can be safely imported by client components
 */

import { customProvider } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { isTestEnvironment } from '../constants';

// Client-side dummy provider for when authentication is not available
const dummyProvider = createOpenAI({
  baseURL: 'dummy-provider-frontend',
  apiKey: 'dummy-key',
});

// Create client-side provider (used for frontend components that don't need real auth)
const clientProvider = customProvider({
  languageModels: {
    'chat-model': dummyProvider.chat('dummy-model'),
    'chat-model-reasoning': dummyProvider.chat('dummy-model'),
    'title-model': dummyProvider.chat('dummy-model'),
    'artifact-model': dummyProvider.chat('dummy-model'),
  },
});

// Export the client provider
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
  : clientProvider; // Always use client provider for client components