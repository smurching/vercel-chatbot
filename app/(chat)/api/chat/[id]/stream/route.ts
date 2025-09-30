import { streamCache } from '@/lib/stream-cache';
import { UI_MESSAGE_STREAM_HEADERS } from 'ai';

/**
 * GET /api/chat/[id]/stream
 *
 * Resume an active stream for a chat. This endpoint is called by the client's
 * `resume` option in useChat when reconnecting after a timeout or page reload.
 *
 * Returns:
 * - 204 No Content: If no active stream exists for this chat
 * - 200 with stream: If an active stream is found, returns all cached chunks
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: chatId } = await params;

  console.log(`[Stream Resume] GET request for chat ${chatId}`);

  // Check if there's an active stream for this chat
  const streamId = streamCache.getActiveStreamId(chatId);

  if (!streamId) {
    console.log(`[Stream Resume] No active stream for chat ${chatId}`);
    return new Response(null, { status: 204 });
  }

  // Get all cached chunks for this stream
  const chunks = streamCache.getStreamChunks(streamId);

  if (!chunks || chunks.length === 0) {
    console.log(`[Stream Resume] No chunks found for stream ${streamId}`);
    return new Response(null, { status: 204 });
  }

  console.log(`[Stream Resume] Resuming stream ${streamId} with ${chunks.length} chunks`);

  // Create a readable stream that replays all cached chunks
  const stream = new ReadableStream({
    start(controller) {
      try {
        // Send all cached chunks
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }

        console.log(`[Stream Resume] Sent ${chunks.length} chunks for stream ${streamId}`);

        // Note: We don't close the controller here because the stream might still be active
        // The actual stream will close when it completes naturally
      } catch (error) {
        console.error('[Stream Resume] Error replaying chunks:', error);
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: UI_MESSAGE_STREAM_HEADERS,
  });
}