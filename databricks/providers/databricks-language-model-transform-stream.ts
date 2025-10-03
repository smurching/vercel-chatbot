import type { LanguageModelV2StreamPart } from '@ai-sdk/provider';

import { composeDatabricksStreamPartTransformers } from '../stream-transformers/databricks-stream-part-transformers';
import { applyDatabricksRawChunkStreamPartTransform } from '../stream-transformers/databricks-raw-chunk-transformer';
import { applyDatabricksTextPartTransform } from '../stream-transformers/databricks-text-parts';
import { applyDatabricksToolCallStreamPartTransform } from '../stream-transformers/databricks-tool-calling';

export const getDatabricksLanguageModelTransformStream = () => {
  let lastChunk = null as LanguageModelV2StreamPart | null;
  const deltaEndIds = new Set<string>();
  const transformerStreamParts = composeDatabricksStreamPartTransformers(
    // Filter out raw chunks except the ones we want to keep
    applyDatabricksRawChunkStreamPartTransform,
    // Add text-start and text-end chunks
    applyDatabricksTextPartTransform,
    // Transform tool call stream parts
    applyDatabricksToolCallStreamPartTransform,
  );
  return new TransformStream<
    LanguageModelV2StreamPart,
    LanguageModelV2StreamPart
  >({
    transform(chunk, controller) {
      try {
        // Apply transformation functions to the incoming chunks
        const { out } = transformerStreamParts([chunk], lastChunk);

        // Enqueue the transformed chunks with deduplication
        out.forEach((transformedChunk) => {
          if (
            transformedChunk.type === 'text-delta' ||
            transformedChunk.type === 'text-start' ||
            transformedChunk.type === 'text-end'
          ) {
            if (deltaEndIds.has(transformedChunk.id)) {
              // If we already have a delta end for this id, don't write it again
              return;
            }
          }
          if (transformedChunk.type === 'text-end') {
            /**
             * We register when a delta ends.
             * We rely on response.output_item.done chunks to display non streamed data
             * so we need to deduplicate them with their corresponding delta chunks.
             */
            deltaEndIds.add(transformedChunk.id);
          }
          controller.enqueue(transformedChunk);
        });

        // Update the last chunk
        lastChunk = out[out.length - 1] ?? lastChunk;
      } catch (error) {
        console.error('Error in databricksMiddleware transform:', error);
        console.error(
          'Stack trace:',
          error instanceof Error ? error.stack : 'No stack available',
        );
        // Continue processing by passing through the original chunk
        controller.enqueue(chunk);
      }
    },
    flush(controller) {
      try {
        // Finally, if there's a dangling text-delta, close it
        if (lastChunk?.type === 'text-delta') {
          controller.enqueue({ type: 'text-end', id: lastChunk.id });
        }
      } catch (error) {
        console.error('Error in databricksMiddleware flush:', error);
      }
    },
  });
};
