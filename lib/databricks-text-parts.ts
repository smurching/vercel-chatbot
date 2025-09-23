import type { LanguageModelV2StreamPart } from '@ai-sdk/provider';
import type { DatabricksStreamPartTransformer } from './databricks-stream-part-transformers';

export const applyDatabricksTextPartTransform: DatabricksStreamPartTransformer<
  LanguageModelV2StreamPart
> = (parts, last) => {
  const out: LanguageModelV2StreamPart[] = [];
  let currentLast: LanguageModelV2StreamPart | null = last;

  for (const incoming of parts) {
    // 1️⃣ Close a dangling text-delta when a non‑text chunk arrives.
    if (
      currentLast?.type === 'text-delta' &&
      incoming.type !== 'text-delta' &&
      incoming.type !== 'text-end'
    ) {
      out.push(incoming);
    } else if (
      // 2️⃣ We have a fresh text‑delta chunk → inject a `text-start`.
      incoming.type === 'text-delta' &&
      (currentLast === null || currentLast.type !== 'text-delta')
    ) {
      out.push({ type: 'text-start', id: incoming.id }, incoming);
    } else if (
      // 3️⃣ A `text-delta` with a **different** id follows another `text-delta` → close the
      incoming.type === 'text-delta' &&
      currentLast?.type === 'text-delta' &&
      currentLast.id !== incoming.id
    ) {
      out.push({ type: 'text-start', id: incoming.id }, incoming);
    } else if (
      incoming.type === 'text-end' &&
      currentLast?.type !== 'text-delta'
    ) {
      // Filter this one out
    } else {
      // Otherwise, pass through the incoming chunk
      out.push(incoming);
    }

    currentLast = out[out.length - 1] ?? currentLast;
  }

  return { out, last: currentLast };
};
