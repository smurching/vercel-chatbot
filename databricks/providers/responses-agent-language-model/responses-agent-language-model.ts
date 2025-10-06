import { createOpenAI } from '@ai-sdk/openai';
import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
} from '@ai-sdk/provider';
import type { DatabricksLanguageModelConfig } from '../databricks-language-model';

export class DatabricksResponsesAgentLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = 'v2';

  readonly modelId: string;

  private readonly config: DatabricksLanguageModelConfig;
  private readonly openaiResponsesLanguageModel: LanguageModelV2;

  constructor(modelId: string, config: DatabricksLanguageModelConfig) {
    this.modelId = modelId;
    this.config = config;
    const openai = createOpenAI({
      baseURL: config.url({ path: '' }),
      fetch: config.fetch,
      apiKey: '__NOT_USED__',
    });
    this.openaiResponsesLanguageModel = openai.responses(modelId);
  }

  get provider(): string {
    return this.config.provider;
  }

  readonly supportedUrls: Record<string, RegExp[]> = {};

  doGenerate(options: LanguageModelV2CallOptions) {
    return this.openaiResponsesLanguageModel.doGenerate(options);
  }

  doStream(options: LanguageModelV2CallOptions) {
    return this.openaiResponsesLanguageModel.doStream(options);
  }
}
