import type { FetchFunction } from '@ai-sdk/provider-utils';

export type DatabricksLanguageModelConfig = {
  provider: string;
  headers: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: FetchFunction;
};
