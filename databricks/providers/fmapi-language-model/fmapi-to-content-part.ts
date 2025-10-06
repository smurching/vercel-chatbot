import type {
  LanguageModelV2Content,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider';
import { DATABRICKS_TOOL_CALL_ID } from '@/databricks/stream-transformers/databricks-tool-calling';
import type { FmapiChunk, FmapiResponse } from './fmapi-schema';

type ToolCallOrResult = Extract<
  LanguageModelV2StreamPart,
  { type: 'tool-call' | 'tool-result' }
>;

export const convertFmapiChunkToMessagePart = (
  chunk: FmapiChunk,
): LanguageModelV2StreamPart[] => {
  const parts: LanguageModelV2StreamPart[] = [];
  const choice = chunk.choices[0];

  if (typeof choice.delta.content === 'string') {
    const extracted = extractPartsFromTextCompletion(choice.delta.content);
    for (const part of extracted) {
      if (part.type === 'text') {
        parts.push({
          type: 'text-delta',
          id: chunk.id,
          delta: part.text,
        });
      } else {
        parts.push(part);
      }
    }
  } else if (Array.isArray(choice.delta.content)) {
    for (const part of choice.delta.content) {
      switch (part.type) {
        case 'text':
          parts.push({
            type: 'text-delta',
            id: chunk.id,
            delta: part.text,
          });
          break;
        case 'image':
          // Images are currently not supported in stream parts
          break;
        case 'reasoning': {
          const summaryText = part.summary.filter(
            (summary) => summary.type === 'summary_text',
          );
          for (const summary of summaryText) {
            parts.push({
              type: 'reasoning-delta',
              id: chunk.id,
              delta: summary.text,
            });
          }
          break;
        }
      }
    }
  }

  return parts;
};

export const convertFmapiResponseToMessagePart = (
  response: FmapiResponse,
): LanguageModelV2Content[] => {
  const parts: LanguageModelV2Content[] = [];
  const choice = response.choices[0];

  if (typeof choice.message.content === 'string') {
    const extracted = extractHostedFunctionCompletionsFromText(
      choice.message.content,
    );
    if (extracted) {
      for (const part of extracted) parts.push(part);
    } else {
      parts.push({ type: 'text', text: choice.message.content });
    }
  } else {
    for (const part of choice.message.content ?? []) {
      if (part.type === 'text') {
        parts.push({ type: 'text', text: part.text });
      } else if (part.type === 'image') {
        // Images are currently not supported in content parts
      } else if (part.type === 'reasoning') {
        const summaryText = part.summary.filter(
          (summary) => summary.type === 'summary_text',
        );
        for (const summary of summaryText) {
          parts.push({ type: 'reasoning', text: summary.text });
        }
      }
    }
  }

  return parts;
};

const extractPartsFromTextCompletion = (
  text: string,
): (ToolCallOrResult | { type: 'text'; text: string })[] => {
  const parts = text.split(
    /(<uc_function_call>.*?<\/uc_function_call>|<uc_function_result>.*?<\/uc_function_result>|<tool_call>.*?<\/tool_call>|<tool_call_result>.*?<\/tool_call_result>)/,
  );

  const accumulated: (ToolCallOrResult | { type: 'text'; text: string })[] = [];
  for (const segment of parts.filter((p) => p !== '')) {
    const hostedFunctionCompletions =
      extractHostedFunctionCompletionsFromText(segment);
    if (hostedFunctionCompletions) {
      accumulated.push(...hostedFunctionCompletions);
    } else {
      accumulated.push({ type: 'text', text: segment });
    }
  }
  return accumulated;
};

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

const getTaggedToolCall = (text: string) => {
  // Legacy tool call tagging
  if (
    text.startsWith('<uc_function_call>') &&
    text.endsWith('</uc_function_call>')
  ) {
    return text
      .replace('<uc_function_call>', '')
      .replace('</uc_function_call>', '');
  }
  // New tool call tagging
  if (text.startsWith('<tool_call>') && text.endsWith('</tool_call>')) {
    return text.replace('<tool_call>', '').replace('</tool_call>', '');
  }
  return null;
};

const getTaggedToolResult = (text: string) => {
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
