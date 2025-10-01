'use client';

import { useEffect, useRef } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';

interface UseStreamReconnectParams {
  status: UseChatHelpers<ChatMessage>['status'];
  resumeStream: UseChatHelpers<ChatMessage>['resumeStream'];
  stop: UseChatHelpers<ChatMessage>['stop'];
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
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
  /**
   * Whether reconnection is enabled
   * Default: true
   */
  enabled?: boolean;
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
  stop,
  setMessages,
  messages,
  inactivityTimeout = 65000, // 65s to be slightly longer than 60s proxy timeout
  maxReconnectAttempts = 5,
  enabled = true,
}: UseStreamReconnectParams) {
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const lastMessageCountRef = useRef(messages.length);
  const isReconnectingRef = useRef(false);
  const hasGivenUpRef = useRef(false);

  useEffect(() => {
    console.log(`[useStreamReconnect] Effect triggered - status=${status}, messages.length=${messages.length}, enabled=${enabled}`);

    // If disabled, do nothing
    if (!enabled) {
      console.log('[useStreamReconnect] Reconnection disabled');
      return;
    }

    // Clear any existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    // Monitor during streaming OR error (error means connection broke mid-stream)
    if (status !== 'streaming' && status !== 'error') {
      console.log(`[useStreamReconnect] Status is ${status}, not monitoring`);
      reconnectAttemptsRef.current = 0;
      isReconnectingRef.current = false;
      hasGivenUpRef.current = false;
      return;
    }

    // Reset success state when streaming successfully
    if (status === 'streaming') {
      hasGivenUpRef.current = false;
    }

    // If we've given up, don't try again until status changes to non-error
    if (hasGivenUpRef.current) {
      return;
    }

    // If we're in error state, try to reconnect immediately
    // BUT only if we have messages (indicating an actual interrupted stream, not a completed one)
    if (status === 'error' && !isReconnectingRef.current) {
      console.log('[useStreamReconnect] Error status detected');

      // If we have no messages or only user messages, the stream probably completed or never started
      // Don't try to reconnect in this case
      const hasAssistantMessages = messages.some(m => m.role === 'assistant');
      if (!hasAssistantMessages && reconnectAttemptsRef.current > 0) {
        console.log('[useStreamReconnect] No assistant messages found after retry, assuming stream completed');
        reconnectAttemptsRef.current = 0;
        isReconnectingRef.current = false;
        hasGivenUpRef.current = true;
        // Stop the stream to reset status to 'ready'
        stop();
        return;
      }

      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.warn(
          `[useStreamReconnect] Max reconnection attempts (${maxReconnectAttempts}) reached, giving up`,
        );
        isReconnectingRef.current = false;
        hasGivenUpRef.current = true;
        // Stop the stream to reset status to 'ready'
        stop();
        return;
      }

      isReconnectingRef.current = true;
      reconnectAttemptsRef.current += 1;

      const backoffDelay = Math.min(
        1000 * Math.pow(2, reconnectAttemptsRef.current - 1),
        10000,
      );

      console.log(`[useStreamReconnect] Reconnecting after ${backoffDelay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

      setTimeout(() => {
        try {
          console.log('[useStreamReconnect] Clearing assistant messages before resume to avoid duplicates');
          // Keep user messages, only clear assistant messages
          // The backend will replay the assistant's response from the beginning
          const userMessages = messages.filter(m => m.role === 'user');
          setMessages(userMessages);

          console.log('[useStreamReconnect] Calling resumeStream()...');
          resumeStream();
        } catch (error) {
          console.error('[useStreamReconnect] Error calling resumeStream:', error);
        } finally {
          isReconnectingRef.current = false;
        }
      }, backoffDelay);

      return;
    }

    // Check if we've received new messages (indicates stream activity)
    if (messages.length > lastMessageCountRef.current) {
      console.log(`[useStreamReconnect] New messages detected: ${messages.length} (was ${lastMessageCountRef.current})`);
      lastMessageCountRef.current = messages.length;
      reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful activity
    }

    // Set up inactivity timer
    console.log(`[useStreamReconnect] Setting inactivity timer for ${inactivityTimeout}ms`);
    inactivityTimerRef.current = setTimeout(() => {
      console.log('[useStreamReconnect] Inactivity timer fired!');
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
          console.log('[useStreamReconnect] Clearing assistant messages before resume to avoid duplicates');
          // Keep user messages, only clear assistant messages
          const userMessages = messages.filter(m => m.role === 'user');
          setMessages(userMessages);

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