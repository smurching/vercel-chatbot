import type { LanguageModelV2StreamPart } from '@ai-sdk/provider';
import type { DatabricksStreamPartTransformer } from './compose-stream-part-transformers';

type DeltaType = 'text' | 'reasoning';

/**
 * Injects start/end deltas for sequential streams.
 */
export const applyDeltaBoundaryTransform: DatabricksStreamPartTransformer<
  LanguageModelV2StreamPart
> = (parts, last) => {
  const out: LanguageModelV2StreamPart[] = [];

  const lastDeltaType = maybeGetDeltaType(last);
  for (const incoming of parts) {
    const incomingDeltaType = maybeGetDeltaType(incoming);
    const incomingId = (incoming as any)?.id as string | undefined;
    const lastId = (last as any)?.id as string | undefined;

    const incomingMatchesLast =
      Boolean((lastDeltaType === incomingDeltaType) !== null) && // Both are deltas and have the same type
      Boolean(incomingId && lastId && incomingId === lastId); // Both have the same id

    if (incomingMatchesLast) {
      out.push(incoming);
      continue;
    }

    if (isDeltaPart(last)) {
      out.push({ type: `${getDeltaType(last)}-end`, id: last.id });
    }
    if (isDeltaPart(incoming)) {
      out.push(
        { type: `${getDeltaType(incoming)}-start`, id: incoming.id },
        incoming,
      );
    }
    out.push(incoming);
    continue;
  }

  return { out };
};

type DeltaPart = Extract<
  LanguageModelV2StreamPart,
  { type: `${DeltaType}-${string}` }
>;
const isDeltaIsh = (
  part?: LanguageModelV2StreamPart | null,
): part is DeltaPart =>
  part?.type.startsWith('text-') ||
  part?.type.startsWith('reasoning-') ||
  false;

const maybeGetDeltaType = (part: LanguageModelV2StreamPart | null) => {
  if (!isDeltaIsh(part)) return null;
  if (part.type.startsWith('text-')) return 'text';
  if (part.type.startsWith('reasoning-')) return 'reasoning';
  return null;
};

const getDeltaType = (part: DeltaPart) => {
  if (part.type.startsWith('text-')) return 'text';
  if (part.type.startsWith('reasoning-')) return 'reasoning';
  throw new Error(`Unknown delta type: ${part.type}`);
};

const isDeltaPart = (
  part: LanguageModelV2StreamPart | null,
): part is Extract<LanguageModelV2StreamPart, { type: `${DeltaType}-delta` }> =>
  part?.type === 'text-delta' || part?.type === 'reasoning-delta';
