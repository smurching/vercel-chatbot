'use client';

import { useEffect, useRef } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';

interface UseStreamReconnectParams {
  status: UseChatHelpers<ChatMessage>['status'];
  resumeStream: UseChatHelpers<ChatMessage>['resumeStream'];
  messages: ChatMessage[];
  /**
   * Maximum time to wait for stream activity before attempting reconnection (ms)
   * Default: 65000 (65 seconds, slightly longer than Databricks Apps 60s timeout)
   */
  inactivityTimeout?: number;
  /**
   * Maximum number of reconnection attempts
   * Default: 5
   */
  maxReconnectAttempts?: number;
}

/**
 * Hook that monitors streaming status and automatically reconnects when the stream
 * times out due to proxy connection limits (e.g., Databricks Apps 60s timeout).
 *
 * This hook:
 * 1. Detects when a stream has been inactive for too long
 * 2. Automatically calls resumeStream() to reconnect
 * 3. Implements exponential backoff for retries
 * 4. Stops retrying after reaching max attempts or when stream completes
 */
export function useStreamReconnect({
  status,
  resumeStream,
  messages,
  inactivityTimeout = 65000, // 65s to be slightly longer than 60s proxy timeout
  maxReconnectAttempts = 5,
}: UseStreamReconnectParams) {
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const lastMessageCountRef = useRef(messages.length);
  const isReconnectingRef = useRef(false);

  useEffect(() => {
    // Clear any existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    // Only monitor when streaming is in progress
    if (status !== 'streaming') {
      reconnectAttemptsRef.current = 0;
      isReconnectingRef.current = false;
      debugger;
      return;
    }

    // Check if we've received new messages (indicates stream activity)
    if (messages.length > lastMessageCountRef.current) {
      lastMessageCountRef.current = messages.length;
      reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful activity
    }

    // Set up inactivity timer
    debugger;
    inactivityTimerRef.current = setTimeout(() => {
      debugger;
      // Check if we've exceeded max reconnection attempts
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.warn(
          `[useStreamReconnect] Max reconnection attempts (${maxReconnectAttempts}) reached, giving up`,
        );
        return;
      }

      // Prevent multiple concurrent reconnection attempts
      if (isReconnectingRef.current) {
        return;
      }

      isReconnectingRef.current = true;
      reconnectAttemptsRef.current += 1;

      console.log(
        `[useStreamReconnect] Stream inactive for ${inactivityTimeout}ms, attempting reconnection (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`,
      );

      // Calculate exponential backoff delay
      const backoffDelay = Math.min(
        1000 * Math.pow(2, reconnectAttemptsRef.current - 1),
        10000,
      );

      // Wait before attempting reconnection
      setTimeout(() => {
        try {
          console.log('[useStreamReconnect] Calling resumeStream()...');
          resumeStream();
        } catch (error) {
          console.error('[useStreamReconnect] Error calling resumeStream:', error);
        } finally {
          isReconnectingRef.current = false;
        }
      }, backoffDelay);
    }, inactivityTimeout);

    // Cleanup
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [status, messages.length, resumeStream, inactivityTimeout, maxReconnectAttempts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, []);
}