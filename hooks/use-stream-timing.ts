'use client';

import { useEffect, useRef } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';

interface UseStreamTimingParams {
  status: UseChatHelpers<ChatMessage>['status'];
  messages: ChatMessage[];
}

/**
 * Hook that tracks and logs streaming timing metrics:
 * - Time from request start to first chunk (TTFB - Time To First Byte)
 * - Time from first chunk to completion
 * - Total streaming duration
 */
export function useStreamTiming({ status, messages }: UseStreamTimingParams) {
  const requestStartTimeRef = useRef<number | null>(null);
  const firstChunkTimeRef = useRef<number | null>(null);
  const previousStatusRef = useRef<typeof status>(status);
  const previousMessageCountRef = useRef(messages.length);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    const previousMessageCount = previousMessageCountRef.current;

    // Track when request starts (transition to 'streaming' status)
    if (previousStatus === 'ready' && status === 'streaming') {
      requestStartTimeRef.current = Date.now();
      firstChunkTimeRef.current = null;
      console.log('[Stream Timing] 🚀 Request started');
    }

    // Track when first chunk arrives (first new message during streaming)
    if (
      status === 'streaming' &&
      messages.length > previousMessageCount &&
      requestStartTimeRef.current &&
      !firstChunkTimeRef.current
    ) {
      firstChunkTimeRef.current = Date.now();
      const ttfb = firstChunkTimeRef.current - requestStartTimeRef.current;
      console.log(
        `[Stream Timing] ⚡ First chunk received after ${ttfb}ms (TTFB)`,
      );
    }

    // Track when stream completes
    if (previousStatus === 'streaming' && status === 'ready') {
      const completionTime = Date.now();

      if (requestStartTimeRef.current) {
        const totalDuration = completionTime - requestStartTimeRef.current;
        console.log(
          `[Stream Timing] ✅ Stream completed in ${totalDuration}ms total`,
        );

        if (firstChunkTimeRef.current) {
          const streamingDuration =
            completionTime - firstChunkTimeRef.current;
          console.log(
            `[Stream Timing] 📊 Breakdown: TTFB=${firstChunkTimeRef.current - requestStartTimeRef.current}ms, Streaming=${streamingDuration}ms`,
          );
        }
      }

      // Reset timing refs
      requestStartTimeRef.current = null;
      firstChunkTimeRef.current = null;
    }

    // Update refs for next render
    previousStatusRef.current = status;
    previousMessageCountRef.current = messages.length;
  }, [status, messages.length]);

  // Log if stream takes too long to start
  useEffect(() => {
    if (status !== 'streaming' || firstChunkTimeRef.current) {
      return;
    }

    if (!requestStartTimeRef.current) {
      return;
    }

    // Check every 10 seconds
    const warningInterval = setInterval(() => {
      if (requestStartTimeRef.current && !firstChunkTimeRef.current) {
        const elapsed = Date.now() - requestStartTimeRef.current;
        console.warn(
          `[Stream Timing] ⏳ No chunks received after ${elapsed}ms - still waiting...`,
        );
      }
    }, 10000);

    return () => clearInterval(warningInterval);
  }, [status]);
}