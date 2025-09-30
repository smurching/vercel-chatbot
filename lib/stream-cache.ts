/**
 * In-memory stream cache for resumable streams.
 *
 * This provides a simple in-memory alternative to Redis for stream resumption.
 * Streams are stored with a TTL and automatically cleaned up.
 *
 * Note: This is not suitable for distributed deployments. For production
 * with multiple instances, use Redis or another distributed cache.
 */

interface CachedStream {
  chatId: string;
  streamId: string;
  chunks: Uint8Array[];
  createdAt: number;
  lastAccessedAt: number;
}

class StreamCache {
  private cache = new Map<string, CachedStream>();
  private activeStreams = new Map<string, string>(); // chatId -> streamId
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
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
          console.log(`[StreamCache] Expired stream ${streamId} for chat ${stream.chatId}`);
        }
      }

      if (expiredKeys.length > 0) {
        console.log(`[StreamCache] Cleaned up ${expiredKeys.length} expired streams`);
      }
    }, 60 * 1000); // Check every minute
  }

  /**
   * Store a stream chunk
   */
  storeChunk(streamId: string, chatId: string, chunk: Uint8Array): void {
    let stream = this.cache.get(streamId);

    if (!stream) {
      stream = {
        chatId,
        streamId,
        chunks: [],
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      };
      this.cache.set(streamId, stream);
      this.activeStreams.set(chatId, streamId);
      console.log(`[StreamCache] Created new stream ${streamId} for chat ${chatId}`);
    }

    stream.chunks.push(chunk);
    stream.lastAccessedAt = Date.now();
  }

  /**
   * Get the active stream ID for a chat
   */
  getActiveStreamId(chatId: string): string | null {
    return this.activeStreams.get(chatId) ?? null;
  }

  /**
   * Get all chunks for a stream
   */
  getStreamChunks(streamId: string): Uint8Array[] | null {
    const stream = this.cache.get(streamId);
    if (!stream) return null;

    stream.lastAccessedAt = Date.now();
    return stream.chunks;
  }

  /**
   * Mark a stream as complete and clean it up
   */
  completeStream(streamId: string): void {
    const stream = this.cache.get(streamId);
    if (stream) {
      this.activeStreams.delete(stream.chatId);
      this.cache.delete(streamId);
      console.log(`[StreamCache] Completed and removed stream ${streamId} for chat ${stream.chatId}`);
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
      console.log(`[StreamCache] Cleared active stream ${streamId} for chat ${chatId}`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      totalStreams: this.cache.size,
      activeChats: this.activeStreams.size,
      streams: Array.from(this.cache.values()).map(s => ({
        streamId: s.streamId,
        chatId: s.chatId,
        chunks: s.chunks.length,
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

// Singleton instance
export const streamCache = new StreamCache();