import type {
  LanguageModelV2Content,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider';
import type {
  chatAgentChunkSchema,
  chatAgentResponseSchema,
} from './chat-agent-schema';
import type { z } from 'zod/v4';
import { DATABRICKS_TOOL_CALL_ID } from '@/databricks/stream-transformers/databricks-tool-calling';

export const convertChatAgentChunkToMessagePart = (
  chunk: z.infer<typeof chatAgentChunkSchema>,
): LanguageModelV2StreamPart[] => {
  const parts = [];
  if (chunk.delta.role === 'assistant') {
    if (chunk.delta.content) {
      parts.push({
        type: 'text-delta',
        id: chunk.delta.id,
        delta: chunk.delta.content,
      } satisfies LanguageModelV2StreamPart);
    }
    chunk.delta.tool_calls?.forEach((toolCall) => {
      parts.push({
        type: 'tool-call',
        toolCallId: toolCall.id,
        input: toolCall.function.arguments,
        toolName: toolCall.function.name,
      } satisfies LanguageModelV2StreamPart);
    });
  } else if (chunk.delta.role === 'tool') {
    parts.push({
      type: 'tool-result',
      toolCallId: chunk.delta.tool_call_id,
      result: chunk.delta.content,
      toolName: DATABRICKS_TOOL_CALL_ID,
    } satisfies LanguageModelV2StreamPart);
  }
  return parts;
};

export const convertChatAgentResponseToMessagePart = (
  response: z.infer<typeof chatAgentResponseSchema>,
): LanguageModelV2Content[] => {
  const parts: LanguageModelV2Content[] = [];
  for (const message of response.messages) {
    if (message.role === 'assistant') {
      parts.push({
        type: 'text',
        text: message.content,
      } satisfies LanguageModelV2Content);
      for (const part of message.tool_calls ?? []) {
        parts.push({
          type: 'tool-call',
          toolCallId: part.id,
          input: part.function.arguments,
          toolName: part.function.name,
        } satisfies LanguageModelV2Content);
      }
    } else if (message.role === 'tool') {
      parts.push({
        type: 'tool-result',
        toolCallId: message.tool_call_id,
        result: message.content,
        toolName: DATABRICKS_TOOL_CALL_ID,
      } satisfies LanguageModelV2Content);
    }
  }
  return parts;
};
