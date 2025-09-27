import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
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

// For server-side usage, we'll dynamically import the authenticated provider
async function getServerProvider() {
  if (typeof window !== 'undefined') {
    // Client-side should never reach here, but just in case
    return clientProvider;
  }

  try {
    const { getServerProviderAction } = await import('./server-provider-action');
    return await getServerProviderAction();
  } catch (error) {
    console.error('Failed to load server provider:', error);
    // Fallback to client provider (though this shouldn't happen in practice)
    return clientProvider;
  }
}

// Cache for server provider to avoid recreating it
let cachedServerProvider: any = null;

// Export the main provider based on environment
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
  : typeof window !== 'undefined'
  ? clientProvider // Client-side: use dummy provider
  : { // Server-side: use smart provider that handles OAuth
      async languageModel(id: string) {
        // Only call getServerProvider when actually needed (not during module init)
        if (!cachedServerProvider) {
          cachedServerProvider = await getServerProvider();
        }
        return await cachedServerProvider.languageModel(id);
      }
    };