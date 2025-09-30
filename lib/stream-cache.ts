/**
 * In-memory stream cache for resumable streams using hybrid pub/sub pattern.
 *
 * This provides a simple in-memory alternative to Redis for stream resumption.
 * Uses ReadableStream tee-ing to allow multiple clients to subscribe to the
 * same ongoing stream, while also caching chunks to support page refreshes.
 *
 * When a client subscribes, they first receive all previously cached chunks,
 * then continue receiving new chunks as they arrive from the live stream.
 *
 * Note: This is not suitable for distributed deployments. For production
 * with multiple instances, use Redis or another distributed cache.
 */

interface CachedStream {
  chatId: string;
  streamId: string;
  stream: ReadableStream<Uint8Array>;
  chunks: Uint8Array[]; // Cached chunks for replay on page refresh
  createdAt: number;
  lastAccessedAt: number;
  subscribers: number;
}

export class StreamCache {
  private cache = new Map<string, CachedStream>();
  private activeStreams = new Map<string, string>(); // chatId -> streamId
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // console.log('[StreamCache] constructor');
    // Start cleanup interval to remove expired streams
    this.startCleanup();
  }

  private startCleanup() {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const expiredKeys: string[] = [];

      for (const [streamId, stream] of this.cache.entries()) {
        if (now - stream.lastAccessedAt > this.TTL_MS) {
          expiredKeys.push(streamId);
        }
      }

      for (const streamId of expiredKeys) {
        const stream = this.cache.get(streamId);
        if (stream) {
          this.activeStreams.delete(stream.chatId);
          this.cache.delete(streamId);
          // console.log(
          //   `[StreamCache] Expired stream ${streamId} for chat ${stream.chatId}`,
          // );
        }
      }

      // if (expiredKeys.length > 0) {
      //   console.log(
      //     `[StreamCache] Cleaned up ${expiredKeys.length} expired streams`,
      //   );
      // }
    }, 60 * 1000); // Check every minute
  }

  /**
   * Store a stream for resumption. The stream will be tee'd to allow
   * multiple subscribers, and chunks will be cached for page refresh support.
   */
  storeStream(
    streamId: string,
    chatId: string,
    stream: ReadableStream<Uint8Array>,
  ): void {
    // Check if stream already exists
    if (this.cache.has(streamId)) {
      // console.warn(
      //   `[StreamCache] Stream ${streamId} already exists, not replacing`,
      // );
      return;
    }

    // Tee the stream - one copy for caching chunks, one for subscribers
    const [cachingStream, subscriberStream] = stream.tee();

    const cachedStream: CachedStream = {
      chatId,
      streamId,
      stream: subscriberStream,
      chunks: [],
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      subscribers: 0,
    };

    this.cache.set(streamId, cachedStream);
    this.activeStreams.set(chatId, streamId);
    console.log(
      `[StreamCache] Stored stream ${streamId} for chat ${chatId}`,
    );

    // Start caching chunks in the background
    (async () => {
      const reader = cachingStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log(
              `[StreamCache] Finished caching ${cachedStream.chunks.length} chunks for stream ${streamId}`,
            );
            break;
          }
          cachedStream.chunks.push(value);
        }
      } catch (error) {
        console.error(
          `[StreamCache] Error caching chunks for stream ${streamId}:`,
          error,
        );
      } finally {
        reader.releaseLock();
      }
    })();
  }

  /**
   * Get the active stream ID for a chat
   */
  getActiveStreamId(chatId: string): string | null {
    return this.activeStreams.get(chatId) ?? null;
  }

  /**
   * Subscribe to a stream with cursor-based replay. Returns a stream that first
   * replays cached chunks starting from the cursor position, then continues with
   * live chunks from the ongoing stream.
   *
   * @param streamId - The ID of the stream to subscribe to
   * @param cursor - The chunk index to start from (0-based). Chunks before this
   *                 index are skipped, preventing duplicate content on reconnection.
   * @returns ReadableStream starting from cursor position, or null if stream not found
   */
  subscribeToStream(
    streamId: string,
    cursor: number = 0,
  ): ReadableStream<Uint8Array> | null {
    const cached = this.cache.get(streamId);
    if (!cached) {
      console.log(`[StreamCache] Stream ${streamId} not found`);
      return null;
    }

    cached.lastAccessedAt = Date.now();
    cached.subscribers += 1;

    // Tee the live stream to create a new independent copy
    const [stream1, stream2] = cached.stream.tee();

    // Store one copy back for future subscribers
    cached.stream = stream1;

    // Get chunks starting from cursor position
    const chunksToReplay = cached.chunks.slice(cursor);

    console.log(
      `[StreamCache] Subscriber ${cached.subscribers} joined stream ${streamId}, ` +
        `cursor=${cursor}, replaying ${chunksToReplay.length} chunks ` +
        `(skipped ${cursor} chunks)`,
    );

    // Create a new stream that first replays chunks from cursor, then continues with live stream
    const cursorStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          // First, enqueue cached chunks starting from cursor
          for (const chunk of chunksToReplay) {
            controller.enqueue(chunk);
          }

          // if (chunksToReplay.length > 0) {
          //   console.log(
          //     `[StreamCache] Replayed ${chunksToReplay.length} cached chunks ` +
          //       `for stream ${streamId} (from cursor ${cursor})`,
          //   );
          // }

          // Then, continue with live stream
          const reader = stream2.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                console.log(
                  `[StreamCache] Live stream completed for subscriber to ${streamId}`,
                );
                controller.close();
                break;
              }
              controller.enqueue(value);
            }
          } finally {
            reader.releaseLock();
          }
        } catch (error) {
          console.error(
            `[StreamCache] Error in cursor stream for ${streamId}:`,
            error,
          );
          controller.error(error);
        }
      },
    });

    return cursorStream;
  }

  /**
   * Mark a stream as complete and clean it up
   */
  completeStream(streamId: string): void {
    const stream = this.cache.get(streamId);
    if (stream) {
      this.activeStreams.delete(stream.chatId);
      this.cache.delete(streamId);
      console.log(
        `[StreamCache] Completed and removed stream ${streamId} for chat ${stream.chatId}`,
      );
    }
  }

  /**
   * Clear the active stream for a chat (e.g., when starting a new message)
   */
  clearActiveStream(chatId: string): void {
    const streamId = this.activeStreams.get(chatId);
    if (streamId) {
      this.cache.delete(streamId);
      this.activeStreams.delete(chatId);
      // console.log(
      //   `[StreamCache] Cleared active stream ${streamId} for chat ${chatId}`,
      // );
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      totalStreams: this.cache.size,
      activeChats: this.activeStreams.size,
      streams: Array.from(this.cache.values()).map((s) => ({
        streamId: s.streamId,
        chatId: s.chatId,
        subscribers: s.subscribers,
        cachedChunks: s.chunks.length,
        ageMs: Date.now() - s.createdAt,
      })),
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    this.activeStreams.clear();
  }
}

/**
 * Using globalThis instantiated in instrumentation.ts to make sure
 * we have a single instance of the stream cache.
 */
export const streamCache = globalThis.streamCache;
