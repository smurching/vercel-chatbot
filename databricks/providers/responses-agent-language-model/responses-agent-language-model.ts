import { extractReasoningMiddleware, wrapLanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2Middleware,
} from '@ai-sdk/provider';
import type { DatabricksLanguageModelConfig } from '../databricks-language-model';
import { DATABRICKS_TOOL_CALL_ID } from '@/databricks/stream-transformers/databricks-tool-calling';
import { getDatabricksLanguageModelTransformStream } from '../databricks-language-model-transform-stream';

export class DatabricksResponsesAgentLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = 'v2';

  readonly modelId: string;

  private readonly config: DatabricksLanguageModelConfig;
  private readonly openaiResponsesLanguageModel: LanguageModelV2;

  constructor(modelId: string, config: DatabricksLanguageModelConfig) {
    this.modelId = modelId;
    this.config = config;
    const openai = createOpenAI({
      baseURL: config.url({ path: '', modelId: '' }),
      fetch: config.fetch,
      apiKey: '__NOT_USED__',
    });
    this.openaiResponsesLanguageModel = wrapLanguageModel({
      model: openai.responses(modelId),
      middleware: [
        extractReasoningMiddleware({ tagName: 'think' }),
        responsesAgentMiddleware,
      ],
    });
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

const responsesAgentMiddleware: LanguageModelV2Middleware = {
  transformParams: async ({ params }) => {
    return {
      ...params,
      // Filter out the DATABRICKS_TOOL_CALL_ID tool
      tools: params.tools?.filter(
        (tool) => tool.name !== DATABRICKS_TOOL_CALL_ID,
      ),
    };
  },
  wrapGenerate: async ({ doGenerate }) => doGenerate(),
  wrapStream: async ({ doStream }) => {
    const { stream, ...rest } = await doStream();
    const transformStream = getDatabricksLanguageModelTransformStream();

    return {
      stream: stream.pipeThrough(transformStream),
      ...rest,
    };
  },
};
