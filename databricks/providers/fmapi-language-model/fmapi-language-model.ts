import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2Content,
  LanguageModelV2FinishReason,
  LanguageModelV2Message,
  LanguageModelV2StreamPart,
  LanguageModelV2TextPart,
} from '@ai-sdk/provider';
import {
  type ParseResult,
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import type { DatabricksLanguageModelConfig } from '../databricks-language-model';
import { DATABRICKS_TOOL_CALL_ID } from '@/databricks/stream-transformers/databricks-tool-calling';
import { getDatabricksLanguageModelTransformStream } from '@/databricks/stream-transformers/databricks-stream-transformer';

export class DatabricksFmapiLanguageModel implements LanguageModelV2 {
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
    const networkArgs = this.getArgs({
      config: this.config,
      options,
      stream: false,
      modelId: this.modelId,
    });

    const { responseHeaders, value: response } = await postJsonToApi({
      ...networkArgs,
      successfulResponseHandler: createJsonResponseHandler(fmapiResponseSchema),
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: z.any(), // TODO: Implement error schema
        errorToMessage: (error) => JSON.stringify(error), // TODO: Implement error to message
        isRetryable: () => false,
      }),
    });

    const choice = response.choices[0];

    const parts: LanguageModelV2Content[] = [];

    if (typeof choice.message.content === 'string') {
      const extractedParts = extractHostedFunctionCompletionsFromText(
        choice.message.content,
      );
      if (extractedParts) {
        for (const part of extractedParts) {
          parts.push(part);
        }
      } else {
        parts.push({ type: 'text', text: choice.message.content });
      }
    } else {
      for (const part of choice.message.content ?? []) {
        if (part.type === 'text') {
          parts.push({ type: 'text', text: part.text });
        } else if (part.type === 'image') {
          // TODO: Handle images
        } else if (part.type === 'reasoning') {
          const summaryText = part.summary.filter(
            (summary) => summary.type === 'summary_text',
          );
          for (const summary of summaryText) {
            parts.push({
              type: 'reasoning',
              text: summary.text,
            });
          }
        }
      }
    }

    return {
      content: parts,
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
    const networkArgs = this.getArgs({
      config: this.config,
      options,
      stream: true,
      modelId: this.modelId,
    });

    const { responseHeaders, value: response } = await postJsonToApi({
      ...networkArgs,
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: z.any(), // TODO: Implement error schema
        errorToMessage: (error) => JSON.stringify(error), // TODO: Implement error to message
        isRetryable: () => false,
      }),
      successfulResponseHandler:
        createEventSourceResponseHandler(fmapiChunkSchema),
      abortSignal: options.abortSignal,
    });

    let finishReason: LanguageModelV2FinishReason = 'unknown';

    return {
      stream: response
        .pipeThrough(
          new TransformStream<
            ParseResult<z.infer<typeof fmapiChunkSchema>>,
            LanguageModelV2StreamPart
          >({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
            },

            transform(chunk, controller) {
              if (options.includeRawChunks) {
                controller.enqueue({ type: 'raw', rawValue: chunk.rawValue });
              }

              // // handle failed chunk parsing / validation:
              if (!chunk.success) {
                finishReason = 'error';
                controller.enqueue({ type: 'error', error: chunk.error });
                return;
              }

              const choice = chunk.value.choices[0];

              if (typeof choice.delta.content === 'string') {
                const parts = extractPartsFromTextCompletion(
                  choice.delta.content,
                  chunk.value.id,
                );
                for (const part of parts) {
                  if (part.type === 'text') {
                    controller.enqueue({
                      type: 'text-delta',
                      id: chunk.value.id,
                      delta: part.text,
                    });
                  }
                  if (part.type === 'tool-call') {
                    controller.enqueue(part);
                  }
                  if (part.type === 'tool-result') {
                    controller.enqueue(part);
                  }
                }
              } else if (Array.isArray(choice.delta.content)) {
                for (const part of choice.delta.content) {
                  switch (part.type) {
                    case 'text':
                      controller.enqueue({
                        type: 'text-delta',
                        id: chunk.value.id,
                        delta: part.text,
                      });
                      break;
                    case 'image':
                      // Not supported yet
                      break;
                    case 'reasoning': {
                      const summaryText = part.summary.filter(
                        (summary) => summary.type === 'summary_text',
                      );
                      for (const summary of summaryText) {
                        controller.enqueue({
                          type: 'reasoning-delta',
                          id: chunk.value.id,
                          delta: summary.text,
                        });
                      }
                      break;
                    }
                  }
                }
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
      request: { body: networkArgs.body },
      response: { headers: responseHeaders },
    };
  }

  private getArgs({
    config,
    options,
    stream,
    modelId,
  }: {
    options: LanguageModelV2CallOptions;
    config: DatabricksLanguageModelConfig;
    stream: boolean;
    modelId: string;
  }) {
    return {
      url: config.url({
        path: '/chat/completions',
      }),
      headers: combineHeaders(config.headers(), options.headers),
      body: {
        messages: options.prompt.map((message: LanguageModelV2Message) => {
          return {
            role: message.role,
            /**
             * TODO:
             * - Handle other parts
             * - Pass tagged tool calls back as text content
             */
            content:
              typeof message.content === 'string'
                ? message.content
                : message.content
                    .filter((part) => part.type === 'text')
                    .map((part) => (part as LanguageModelV2TextPart).text)
                    .join('\n'),
          };
        }),
        stream,
        model: modelId,
        fetch: config.fetch,
      },
    };
  }
}

const extractPartsFromTextCompletion = (
  text: string,
  completionId: string,
): (ToolCallOrResult | LanguageModelV2TextPart)[] => {
  const parts = text.split(
    /(<uc_function_call>.*?<\/uc_function_call>|<uc_function_result>.*?<\/uc_function_result>)/,
  );

  return parts
    .filter((part) => part !== '')
    .flatMap((part): (ToolCallOrResult | LanguageModelV2TextPart)[] => {
      const hostedFunctionCompletions =
        extractHostedFunctionCompletionsFromText(part);
      if (hostedFunctionCompletions) return hostedFunctionCompletions;
      return [{ type: 'text', text: part }];
    });
};

type ToolCallOrResult = Extract<
  LanguageModelV2StreamPart,
  { type: 'tool-call' | 'tool-result' }
>;
const extractHostedFunctionCompletionsFromText = (
  text: string,
): ToolCallOrResult[] | null => {
  try {
    const trimmed = text.trim();
    const toolCall = getTaggedToolCall(trimmed);
    if (toolCall) {
      const parsed = JSON.parse(toolCall);
      return [
        {
          type: 'tool-call',
          input: parsed.arguments,
          toolName: parsed.name,
          toolCallId: parsed.id,
          providerExecuted: true,
        },
      ];
    }
    const toolResult = getTaggedToolResult(trimmed);
    if (toolResult) {
      const parsed = JSON.parse(toolResult);
      return [
        {
          type: 'tool-result',
          result: parsed.content,
          toolCallId: parsed.id,
          toolName: DATABRICKS_TOOL_CALL_ID,
        },
      ];
    }
    return null;
  } catch {
    return null;
  }
};

// Function to extract tool calls from completion text
export const getTaggedToolCall = (text: string) => {
  // Legacy tool call tagging
  if (
    text.startsWith('<uc_function_call>') &&
    text.endsWith('</uc_function_call>')
  ) {
    return text
      .replace('<uc_function_call>', '')
      .replace('</uc_function_call>', '');
  }
  // This is the new way of tagging tool calls
  if (text.startsWith('<tool_call>') && text.endsWith('</tool_call>')) {
    return text.replace('<tool_call>', '').replace('</tool_call>', '');
  }
  return null;
};

export const getTaggedToolResult = (text: string) => {
  if (
    text.startsWith('<uc_function_result>') &&
    text.endsWith('</uc_function_result>')
  ) {
    return text
      .replace('<uc_function_result>', '')
      .replace('</uc_function_result>', '');
  }
  if (
    text.startsWith('<tool_call_result>') &&
    text.endsWith('</tool_call_result>')
  ) {
    return text
      .replace('<tool_call_result>', '')
      .replace('</tool_call_result>', '');
  }
  return null;
};

// Zod schemas mirroring FMAPI chat chunk types
const reasoningSummarySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('summary_text'),
    text: z.string(),
    signature: z.string().optional(),
  }),
  z.object({
    type: z.literal('summary_encrypted_text'),
    data: z.string(),
  }),
]);

const contentItemSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    text: z.string(),
    citation: z.unknown().optional(),
  }),
  z.object({
    type: z.literal('image'),
    image_url: z.string(),
  }),
  z.object({
    type: z.literal('reasoning'),
    summary: z.array(reasoningSummarySchema),
  }),
]);

const fmapiChunkSchema = z.object({
  id: z.string(),
  created: z.number(),
  model: z.string(),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number(),
  }),
  object: z.literal('chat.completion.chunk'),
  choices: z.array(
    z.object({
      index: z.number(),
      delta: z.object({
        role: z
          .union([z.literal('assistant'), z.null(), z.undefined()])
          .optional(),
        content: z.union([z.string(), z.array(contentItemSchema)]).optional(),
      }),
      finish_reason: z.union([z.literal('stop'), z.null()]).optional(),
    }),
  ),
});

const fmapiResponseSchema = z.object({
  id: z.string(),
  created: z.number(),
  model: z.string(),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number(),
  }),
  choices: z.array(
    z.object({
      message: z.object({
        role: z.union([
          z.literal('assistant'),
          z.literal('user'),
          z.literal('tool'),
        ]),
        content: z.union([z.string(), z.array(contentItemSchema)]).optional(),
      }),
    }),
  ),
});
