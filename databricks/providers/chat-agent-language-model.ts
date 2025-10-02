import type {
  LanguageModelV2,
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
  LanguageModelV2TextPart,
} from '@ai-sdk/provider';
import {
  type FetchFunction,
  type ParseResult,
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonErrorResponseHandler,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

type DatabricksLanguageModelConfig = {
  provider: string;
  headers: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: FetchFunction;
};

export class DatabricksChatAgentLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = 'v2';

  readonly modelId: string;

  private readonly config: DatabricksLanguageModelConfig;

  constructor(modelId: string, config: DatabricksLanguageModelConfig) {
    this.modelId = modelId;
    this.config = config;
  }

  get provider(): string {
    return this.config.provider;
  }

  readonly supportedUrls: Record<string, RegExp[]> = {};

  async doGenerate(
    options: Parameters<LanguageModelV2['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV2['doGenerate']>>> {
    // TODO: Implement non streaming generation

    return {
      content: [],
      finishReason: 'stop',
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
      warnings: [],
    };
  }

  async doStream(
    options: Parameters<LanguageModelV2['doStream']>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV2['doStream']>>> {
    const body = {
      model: this.modelId,
      stream: true,
      messages: options.prompt.map((message) => ({
        role: message.role,
        content:
          typeof message.content === 'string'
            ? message.content
            : message.content
                .filter((part) => part.type === 'text')
                .map((part) => (part as LanguageModelV2TextPart).text)
                .join('\n'),
      })),
    };

    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.config.url({
        path: '/completions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body,
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: z.any(), // TODO: Implement error schema
        errorToMessage: (error) => JSON.stringify(error), // TODO: Implement error to message
        isRetryable: () => false,
      }),
      successfulResponseHandler:
        createEventSourceResponseHandler(chatAgentDeltaSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    let finishReason: LanguageModelV2FinishReason = 'unknown';

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<z.infer<typeof chatAgentDeltaSchema>>,
          LanguageModelV2StreamPart
        >({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
          },

          transform(chunk, controller) {
            console.log('[DatabricksChatAgentLanguageModel] transform', chunk);
            if (options.includeRawChunks) {
              controller.enqueue({ type: 'raw', rawValue: chunk.rawValue });
            }

            // // handle failed chunk parsing / validation:
            if (!chunk.success) {
              finishReason = 'error';
              controller.enqueue({ type: 'error', error: chunk.error });
              return;
            }

            controller.enqueue({
              type: 'text-delta',
              id: chunk.value.id,
              delta: chunk.value.delta.content,
            });
          },

          flush(controller) {
            controller.enqueue({
              type: 'finish',
              finishReason,
              usage: {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
              },
            });
          },
        }),
      ),
      request: { body },
      response: { headers: responseHeaders },
    };
  }
}

const chatAgentDeltaSchema = z.object({
  delta: z.object({
    role: z.string(),
    content: z.string(),
    id: z.string(),
  }),
  id: z.string(),
});
