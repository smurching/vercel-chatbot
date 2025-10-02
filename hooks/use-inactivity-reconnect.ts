'use client';

import { useEffect, useRef, useCallback, useMemo } from 'react';

import type { ChatMessage } from '@/lib/types';

/**
 * Options accepted by the hook.
 *
 * @param messages         – Full array of ChatMessage objects returned by `useChat`.
 * @param resumeStream     – Function that restarts the stream (identical to the one used by `useErrorReconnect`).
 * @param inactivityDelayMs – How long (in ms) we tolerate *no* new content before we treat it as idle.
 * @param maxAttempts      – Maximum number of automatic resume attempts triggered by inactivity.
 *                           0 = unlimited (default is 0 – you decide what feels safe for your app).
 * @param jitterMs         – Random extra ms added to the timeout to avoid a thundering‑herd effect.
 */
export interface UseInactivityReconnectOptions {
  messages: ChatMessage[];
  resumeStream: () => Promise<void>;
  inactivityDelayMs?: number;
  maxAttempts?: number;
  jitterMs?: number;
}

/**
 * useInactivityReconnect monitors the *latest assistant message* for activity.
 * If the message does not grow for `inactivityDelayMs` the supplied `resumeStream`
 * function is called. The hook automatically resets the watchdog every time a new
 * part (text token, image, tool call, etc.) is appended.
 *
 * After the first timeout it will retry **every 5 seconds** (plus jitter) until
 * activity is observed again or `maxAttempts` is reached.
 */
export function useInactivityReconnect({
  messages,
  resumeStream,
  inactivityDelayMs = 65_000,
  maxAttempts = 0,
  jitterMs = 250,
}: UseInactivityReconnectOptions) {
  /* ----------------------------------------------------------------------
     Refs – mutable values that survive re‑renders without causing extra renders.
     ---------------------------------------------------------------------- */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const lastContentMetricRef = useRef<number>(0);
  const attemptCountRef = useRef(0);
  const unmountedRef = useRef(false);
  const resumeFnRef = useRef(resumeStream);
  // keep the newest resumeStream in the ref (prevents stale‑closure bugs)
  resumeFnRef.current = resumeStream;

  /* ----------------------------------------------------------------------
     Constants
     ---------------------------------------------------------------------- */
  const RETRY_DELAY_MS = 5_000; // 5‑second interval after the first attempt

  /* ----------------------------------------------------------------------
     Helper – clear any pending timeout.
     ---------------------------------------------------------------------- */
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /* ----------------------------------------------------------------------
     Helper – compute a cheap “size” metric for a ChatMessage.
     ---------------------------------------------------------------------- */
  const computeContentMetric = (msg: ChatMessage | null): number => {
    if (!msg) return 0;
    let total = 0;
    for (const part of msg.parts) {
      switch (part.type) {
        case 'text':
        case 'reasoning':
          total += part.text.length;
          break;
        case 'source-url':
          total += 1;
          break;
        default:
          total += 1;
      }
    }
    return total;
  };

  /* ----------------------------------------------------------------------
     Determine which message we should be watching.
     ---------------------------------------------------------------------- */
  const streamingAssistantMessage = useMemo<ChatMessage | null>(() => {
    const lastMessage = messages.at(-1);
    if (lastMessage?.role === 'assistant') return lastMessage;
    return null;
  }, [messages]);

  const currentMessageId = streamingAssistantMessage?.id ?? null;
  const currentContentMetric = computeContentMetric(streamingAssistantMessage);

  /**
   * Schedules the inactivity watchdog.
   *
   * @param isRetry  – `false` for the *initial* delay (`inactivityDelayMs`),
   *                   `true` for the repeated 5‑second retries.
   */
  const scheduleTimer = useCallback(
    (isRetry = false) => {
      clearTimer();

      const jitter = Math.random() * jitterMs;
      const baseDelay = isRetry ? RETRY_DELAY_MS : inactivityDelayMs;
      const delay = baseDelay + jitter;

      timerRef.current = setTimeout(async () => {
        if (unmountedRef.current) return;

        // Respect maxAttempts (0 = unlimited)
        if (maxAttempts > 0 && attemptCountRef.current >= maxAttempts) {
          console.warn(
            `[useInactivityReconnect] Max inactivity attempts (${maxAttempts}) reached – giving up.`,
          );
          return;
        }

        attemptCountRef.current += 1;
        console.info(
          `[useInactivityReconnect] Inactivity detected – invoking resumeStream (attempt ${attemptCountRef.current})`,
        );

        try {
          await resumeFnRef.current();
          // Whether it succeeds or not we continue retrying on the same interval
          // until activity resets the timer (see the effect below).
        } catch (err) {
          console.error('[useInactivityReconnect] resumeStream threw:', err);
        }

        // After the first attempt we keep retrying every RETRY_DELAY_MS.
        if (
          !unmountedRef.current &&
          (maxAttempts === 0 || attemptCountRef.current < maxAttempts)
        ) {
          scheduleTimer(true); // schedule the *next* retry (5 s later)
        }
      }, delay);
    },
    [clearTimer, inactivityDelayMs, jitterMs, maxAttempts],
  );

  /* ----------------------------------------------------------------------
     Core effect – runs whenever the observed message ID or its content metric
     changes (i.e. whenever the assistant streams a new token/part).
     ---------------------------------------------------------------------- */
  useEffect(() => {
    if (unmountedRef.current) return;

    // ----------------------------------------------------
    // No assistant message to watch → clean up everything.
    // ----------------------------------------------------
    if (!streamingAssistantMessage) {
      clearTimer();
      lastMessageIdRef.current = null;
      lastContentMetricRef.current = 0;
      attemptCountRef.current = 0;
      return;
    }

    // ----------------------------------------------------
    // Detect activity:
    //   * a brand‑new assistant message, OR
    //   * the current message grew (more tokens/parts).
    // ----------------------------------------------------
    const isNewMessage = currentMessageId !== lastMessageIdRef.current;
    const isNewContent = currentContentMetric > lastContentMetricRef.current;

    if (isNewMessage || isNewContent) {
      // Activity → reset attempt count and start a fresh watchdog.
      attemptCountRef.current = 0;
      scheduleTimer(false); // first timeout = inactivityDelayMs

      // Update our “last known” values for the next render cycle.
      lastMessageIdRef.current = currentMessageId;
      lastContentMetricRef.current = currentContentMetric;
    } else {
      // ----------------------------------------------------
      // No activity detected this render.
      // If a timer is already running we keep it – otherwise we start one.
      // ----------------------------------------------------
      if (!timerRef.current) {
        scheduleTimer(false);
      }
    }

    // ------------------------------------------------------------------
    // Clean‑up when the component unmounts or when the effect re‑runs.
    // ------------------------------------------------------------------
    return () => {
      clearTimer();
    };
  }, [
    streamingAssistantMessage,
    currentMessageId,
    currentContentMetric,
    scheduleTimer,
    clearTimer,
  ]);

  /* ----------------------------------------------------------------------
     Unmount clean‑up – ensure we never fire after the component is gone.
     ---------------------------------------------------------------------- */
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      clearTimer();
    };
  }, [clearTimer]);
}
