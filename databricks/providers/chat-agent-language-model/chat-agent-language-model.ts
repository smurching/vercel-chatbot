import type {
  LanguageModelV2,
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
  LanguageModelV2TextPart,
} from '@ai-sdk/provider';
import {
  type ParseResult,
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonErrorResponseHandler,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import type { DatabricksLanguageModelConfig } from '../databricks-language-model';
import { DATABRICKS_TOOL_CALL_ID } from '@/databricks/stream-transformers/databricks-tool-calling';
import { getDatabricksLanguageModelTransformStream } from '@/databricks/stream-transformers/databricks-stream-transformer';

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
        createEventSourceResponseHandler(chatAgentChunkSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    let finishReason: LanguageModelV2FinishReason = 'unknown';

    return {
      stream: response
        .pipeThrough(
          new TransformStream<
            ParseResult<z.infer<typeof chatAgentChunkSchema>>,
            LanguageModelV2StreamPart
          >({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
            },

            transform(chunk, controller) {
              console.log(
                '[DatabricksChatAgentLanguageModel] transform',
                chunk,
              );
              if (options.includeRawChunks) {
                controller.enqueue({ type: 'raw', rawValue: chunk.rawValue });
              }

              // // handle failed chunk parsing / validation:
              if (!chunk.success) {
                finishReason = 'error';
                controller.enqueue({ type: 'error', error: chunk.error });
                return;
              }

              for (const part of convertChatAgentMessageToMessagePart(
                chunk.value.delta,
              )) {
                controller.enqueue(part);
              }
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
        )
        .pipeThrough(getDatabricksLanguageModelTransformStream()),
      request: { body },
      response: { headers: responseHeaders },
    };
  }
}

const convertChatAgentMessageToMessagePart = (
  message: z.infer<typeof chatAgentMessageSchema>,
): LanguageModelV2StreamPart[] => {
  const parts = [];
  if (message.role === 'assistant') {
    if (message.content) {
      parts.push({
        type: 'text-delta',
        id: message.id,
        delta: message.content,
      } satisfies LanguageModelV2StreamPart);
    }
    message.tool_calls?.forEach((toolCall) => {
      parts.push({
        type: 'tool-call',
        toolCallId: toolCall.id,
        input: toolCall.function.arguments,
        toolName: toolCall.function.name,
      } satisfies LanguageModelV2StreamPart);
    });
  } else if (message.role === 'tool') {
    parts.push({
      type: 'tool-result',
      toolCallId: message.tool_call_id,
      result: message.content,
      toolName: DATABRICKS_TOOL_CALL_ID,
    } satisfies LanguageModelV2StreamPart);
  }
  return parts;
};

// Zod schemas for Chat Agent, derived from LEGACY/chat-agent/types

// Tool call schema
const chatAgentToolCallSchema = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
  id: z.string(),
});

// Message schemas (discriminated by role)
const chatAgentAssistantMessageSchema = z.object({
  role: z.literal('assistant'),
  content: z.string(), // required, empty string allowed
  id: z.string(),
  name: z.string().optional(),
  tool_calls: z.array(chatAgentToolCallSchema).optional(),
});

const chatAgentToolMessageSchema = z.object({
  role: z.literal('tool'),
  name: z.string(),
  content: z.string(),
  tool_call_id: z.string(),
  id: z.string(),
  attachments: z.record(z.string(), z.unknown()).optional(),
});

const chatAgentUserMessageSchema = z.object({
  role: z.literal('user'),
  content: z.string(),
  id: z.string(),
});

const chatAgentMessageSchema = z.discriminatedUnion('role', [
  chatAgentAssistantMessageSchema,
  chatAgentToolMessageSchema,
  chatAgentUserMessageSchema,
]);

// Stream chunk schema (used for SSE parsing)
const chatAgentChunkSchema = z.object({
  id: z.string(),
  delta: chatAgentMessageSchema,
});

// Full response schema (not used in streaming handler, but kept for completeness)
const chatAgentResponseSchema = z.object({
  id: z.string(),
  messages: z.array(chatAgentMessageSchema),
});
