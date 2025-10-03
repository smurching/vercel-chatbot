import type { LanguageModelV2StreamPart } from '@ai-sdk/provider';
import type { DatabricksStreamPartTransformer } from './compose-stream-part-transformers';

export const applyDatabricksReasoningDeltaPartTransform: DatabricksStreamPartTransformer<
  LanguageModelV2StreamPart
> = (parts, last) => {
  const out: LanguageModelV2StreamPart[] = [];

  for (const incoming of parts) {
    if (
      last?.type === 'reasoning-delta' &&
      incoming.type !== 'reasoning-delta' &&
      incoming.type !== 'reasoning-end'
    ) {
      out.push(incoming);
    } else if (
      // 2️⃣ We have a fresh text‑delta chunk → inject a `reasoning-start`.
      incoming.type === 'reasoning-delta' &&
      (last === null || last.type !== 'reasoning-delta')
    ) {
      out.push({ type: 'reasoning-start', id: incoming.id }, incoming);
    } else if (
      // 3️⃣ A `reasoning-delta` with a **different** id follows another `reasoning-delta` → close the
      incoming.type === 'reasoning-delta' &&
      last?.type === 'reasoning-delta' &&
      last.id !== incoming.id
    ) {
      out.push({ type: 'reasoning-start', id: incoming.id }, incoming);
    } else if (
      incoming.type === 'reasoning-end' &&
      last?.type !== 'reasoning-delta'
    ) {
      // Filter this one out
    } else {
      // Otherwise, pass through the incoming chunk
      out.push(incoming);
    }
  }

  return { out };
};
