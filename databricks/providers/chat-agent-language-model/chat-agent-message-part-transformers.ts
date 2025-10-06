import type {
  LanguageModelV2Content,
  LanguageModelV2Prompt,
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

export const convertLanguageModelV2PromptToChatAgentResponse = (
  prompt: LanguageModelV2Prompt,
): z.infer<typeof chatAgentResponseSchema> => {
  const messages: z.infer<typeof chatAgentResponseSchema>['messages'] = [];

  let messageIndex = 0;

  for (const msg of prompt) {
    if (msg.role === 'system') {
      // System messages are prompt-only; they don't exist in ChatAgent responses.
      continue;
    }

    if (msg.role === 'user') {
      const text = (msg.content ?? [])
        .filter(
          (part): part is Extract<typeof part, { type: 'text' }> =>
            part.type === 'text',
        )
        .map((part) => part.text)
        .join('\n');

      messages.push({
        role: 'user',
        content: text,
        id: `user-${messageIndex++}`,
      });
      continue;
    }

    if (msg.role === 'assistant') {
      const textContent = (msg.content ?? [])
        .filter((part) => part.type === 'text' || part.type === 'reasoning')
        .map((part: any) => (part.type === 'text' ? part.text : part.text))
        .join('\n');

      const toolCalls = (msg.content ?? [])
        .filter(
          (part): part is Extract<typeof part, { type: 'tool-call' }> =>
            part.type === 'tool-call',
        )
        .map((call) => ({
          type: 'function' as const,
          id: call.toolCallId,
          function: {
            name: call.toolName,
            arguments:
              typeof (call as any).input === 'string'
                ? ((call as any).input as string)
                : JSON.stringify((call as any).input ?? {}),
          },
        }));

      messages.push({
        role: 'assistant',
        content: textContent,
        id: `assistant-${messageIndex++}`,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      });

      // Convert any tool results embedded in the assistant message into separate tool messages.
      for (const part of msg.content ?? []) {
        if (part.type === 'tool-result') {
          const content = (() => {
            switch (part.output.type) {
              case 'text':
                return part.output.value;
              case 'json':
                return JSON.stringify(part.output.value);
              case 'error-text':
                return part.output.value;
              case 'error-json':
                return JSON.stringify(part.output.value);
              case 'content':
                return part.output.value
                  .map((p) => (p.type === 'text' ? p.text : ''))
                  .filter(Boolean)
                  .join('\n');
              default:
                return '';
            }
          })();

          messages.push({
            role: 'tool',
            name: part.toolName,
            content,
            tool_call_id: part.toolCallId,
            id: `tool-${messageIndex++}`,
          });
        }
      }
      continue;
    }

    if (msg.role === 'tool') {
      for (const part of msg.content ?? []) {
        if (part.type !== 'tool-result') continue;

        const content = (() => {
          switch (part.output.type) {
            case 'text':
              return part.output.value;
            case 'json':
              return JSON.stringify(part.output.value);
            case 'error-text':
              return part.output.value;
            case 'error-json':
              return JSON.stringify(part.output.value);
            case 'content':
              return part.output.value
                .map((p) => (p.type === 'text' ? p.text : ''))
                .filter(Boolean)
                .join('\n');
            default:
              return '';
          }
        })();

        messages.push({
          role: 'tool',
          name: part.toolName,
          content,
          tool_call_id: part.toolCallId,
          id: `tool-${messageIndex++}`,
        });
      }
      continue;
    }
  }

  return {
    id: 'converted-from-prompt',
    messages,
  };
};
