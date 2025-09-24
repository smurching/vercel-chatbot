import type { LanguageModelV2StreamPart } from '@ai-sdk/provider';
import type { DatabricksStreamPartTransformer } from './databricks-stream-part-transformers';

type DatabricksReasoningDeltaStreamPart = {
  INCOMING_TYPE: {
    type: 'raw';
    rawValue: {
      type: 'response.reasoning_text.delta';
      item_id: string;
      output_index: number;
      content_index: number;
      delta: string;
      sequence_number: number;
      id: string;
    };
  };
  OUTGOING_TYPE: Extract<
    LanguageModelV2StreamPart,
    { type: `reasoning-${string}` }
  >;
};

/**
 * Stream part transformers
 */
export const applyDatabricksReasoningStreamPartTransform: DatabricksStreamPartTransformer<
  LanguageModelV2StreamPart
> = (parts, last) => {
  let currentLast = last;
  const out: LanguageModelV2StreamPart[] = [];
  for (const part of parts) {
    const injections: LanguageModelV2StreamPart[] = [];
    if (isRawReasoningDelta(part)) {
      injections.push(...transformReasoningDelta(part, last));
    }
    if (injections.length > 0) {
      out.push(...injections);
      currentLast = out[out.length - 1] ?? currentLast;
    } else {
      out.push(part);
    }
  }
  return {
    out,
    last: currentLast,
  };
};

const transformReasoningDelta = (
  part: DatabricksReasoningDeltaStreamPart['INCOMING_TYPE'],
  last: LanguageModelV2StreamPart | null,
): DatabricksReasoningDeltaStreamPart['OUTGOING_TYPE'][] => {
  const reasoningDelta: DatabricksReasoningDeltaStreamPart['OUTGOING_TYPE'] = {
    type: 'reasoning-delta',
    id: part.rawValue.id,
    delta: part.rawValue.delta,
  };

  const shouldStartNewReasoningBlock =
    !last ||
    (last?.type !== 'reasoning-delta' && last?.type !== 'reasoning-start');

  if (shouldStartNewReasoningBlock) {
    return [{ type: 'reasoning-start', id: part.rawValue.id }, reasoningDelta];
  }
  return [reasoningDelta];
};

/**
 * Type guards
 */
export const isRawReasoningDelta = (
  part: LanguageModelV2StreamPart,
): part is DatabricksReasoningDeltaStreamPart['INCOMING_TYPE'] =>
  part.type === 'raw' &&
  (part.rawValue as any)?.type === 'response.reasoning_text.delta';
