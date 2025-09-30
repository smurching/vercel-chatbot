/**
 * In-memory stream cache for resumable streams using pub/sub pattern.
 *
 * This provides a simple in-memory alternative to Redis for stream resumption.
 * Uses ReadableStream tee-ing to allow multiple clients to subscribe to the
 * same ongoing stream.
 *
 * Note: This is not suitable for distributed deployments. For production
 * with multiple instances, use Redis or another distributed cache.
 */

interface CachedStream {
  chatId: string;
  streamId: string;
  stream: ReadableStream<Uint8Array>;
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
    console.log('[StreamCache] constructor');
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
          console.log(
            `[StreamCache] Expired stream ${streamId} for chat ${stream.chatId}`,
          );
        }
      }

      if (expiredKeys.length > 0) {
        console.log(
          `[StreamCache] Cleaned up ${expiredKeys.length} expired streams`,
        );
      }
    }, 60 * 1000); // Check every minute
  }

  /**
   * Store a stream for resumption. The stream will be tee'd to allow
   * multiple subscribers.
   */
  storeStream(
    streamId: string,
    chatId: string,
    stream: ReadableStream<Uint8Array>,
  ): void {
    // Check if stream already exists
    if (this.cache.has(streamId)) {
      console.warn(
        `[StreamCache] Stream ${streamId} already exists, not replacing`,
      );
      return;
    }

    const cachedStream: CachedStream = {
      chatId,
      streamId,
      stream,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      subscribers: 0,
    };

    this.cache.set(streamId, cachedStream);
    this.activeStreams.set(chatId, streamId);
    console.log(
      `[StreamCache] Stored stream ${streamId} for chat ${chatId}`,
    );
  }

  /**
   * Get the active stream ID for a chat
   */
  getActiveStreamId(chatId: string): string | null {
    return this.activeStreams.get(chatId) ?? null;
  }

  /**
   * Subscribe to a stream. Returns a tee'd copy of the stream that can be
   * consumed independently. Returns null if stream doesn't exist.
   */
  subscribeToStream(streamId: string): ReadableStream<Uint8Array> | null {
    const cached = this.cache.get(streamId);
    if (!cached) {
      console.log(`[StreamCache] Stream ${streamId} not found`);
      return null;
    }

    cached.lastAccessedAt = Date.now();
    cached.subscribers += 1;

    // Tee the stream to create a new independent copy
    const [stream1, stream2] = cached.stream.tee();

    // Store one copy back for future subscribers
    cached.stream = stream1;

    console.log(
      `[StreamCache] Subscriber ${cached.subscribers} joined stream ${streamId}`,
    );

    // Return the other copy to this subscriber
    return stream2;
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
      console.log(
        `[StreamCache] Cleared active stream ${streamId} for chat ${chatId}`,
      );
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
