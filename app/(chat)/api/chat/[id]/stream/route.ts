import { streamCache } from '@/lib/stream-cache';
import { UI_MESSAGE_STREAM_HEADERS } from 'ai';

/**
 * GET /api/chat/[id]/stream?cursor=N
 *
 * Subscribe to an active stream for a chat with optional cursor support.
 * This endpoint is called by the client's resume option in useChat when
 * reconnecting after a timeout or page reload.
 *
 * Query Parameters:
 * - cursor (optional): Chunk index to start from. If provided, only chunks
 *   after this index are sent, preventing duplicate content on reconnection.
 *
 * Returns:
 * - 204 No Content: If no active stream exists for this chat
 * - 200 with stream: If an active stream is found, returns a subscription
 *   starting from the specified cursor position (or beginning if no cursor)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: chatId } = await params;

  // Parse cursor from query params
  const url = new URL(request.url);
  const cursorParam = url.searchParams.get('cursor');
  const cursor = cursorParam ? parseInt(cursorParam, 10) : 0;

  console.log(`[Stream Resume] GET request for chat ${chatId}, cursor=${cursor}`);

  // Check if there's an active stream for this chat
  const streamId = streamCache.getActiveStreamId(chatId);

  if (!streamId) {
    // console.log(`[Stream Resume] No active stream for chat ${chatId}`);
    return new Response(null, { status: 204 });
  }

  // Subscribe to the stream from the specified cursor position
  // This prevents duplicate content by skipping chunks the client already has
  const stream = streamCache.subscribeToStream(streamId, cursor);

  if (!stream) {
    // console.log(`[Stream Resume] Stream ${streamId} not found in cache`);
    return new Response(null, { status: 204 });
  }

  console.log(
    `[Stream Resume] Client subscribed to stream ${streamId} from cursor ${cursor}`,
  );

  return new Response(stream, {
    status: 200,
    headers: UI_MESSAGE_STREAM_HEADERS,
  });
}