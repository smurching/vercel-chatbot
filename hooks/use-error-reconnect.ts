/* ────────────────────────────────────────────────────────────────────────
   useErrorReconnect – reconnect on "error" status with back‑off
   ─────────────────────────────────────────────────────────────────────── */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';

/**
 * Parameters accepted by the hook.
 *
 * @param status        – current streaming status from useChat()
 * @param resumeStream  – function that restarts the stream
 * @param baseDelayMs   – first wait time before a retry (default 1 000 ms)
 * @param maxAttempts   – stop after this many retries (default 5, 0 = unlimited)
 * @param jitterMs      – random extra delay to avoid stampeding (default 250 ms)
 */
export interface UseErrorReconnectParams {
  status: UseChatHelpers<ChatMessage>['status'];
  resumeStream: UseChatHelpers<ChatMessage>['resumeStream'];
  /** First delay before a retry (ms). */
  baseDelayMs?: number;
  /** Max number of reconnection attempts (0 = unlimited). */
  maxAttempts?: number;
  /** Random extra time added to each wait (ms). Helps avoid thundering‑herd. */
  jitterMs?: number;
}

/**
 * Hook that automatically retries `resumeStream()` when the streaming status
 * becomes `"error"`. It uses exponential back‑off with optional jitter and
 * respects a configurable maximum number of attempts.
 *
 *   const { status, resumeStream } = useChat(...);
 *   useErrorReconnect({ status, resumeStream });
 */
export function useErrorReconnect({
  status,
  resumeStream,
  baseDelayMs = 1_000,
  maxAttempts = 5,
  jitterMs = 250,
}: UseErrorReconnectParams) {
  /* ----------------------------------------------------------------------
        Refs – they survive re‑renders without causing extra renders.
        ---------------------------------------------------------------------- */
  const attemptRef = useRef(0); // how many tries we have already made
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

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
        1️⃣  Reset state when we *leave* the error condition.
            (status becomes "idle"/"loading"/"complete")
        ---------------------------------------------------------------------- */
  useEffect(() => {
    if (status !== 'error') {
      attemptRef.current = 0;
      clearTimer();
      return;
    }
    // else: we *are* in an error state → let the effect below schedule a retry
  }, [status, clearTimer]);

  /* ----------------------------------------------------------------------
        2️⃣  Main effect – schedule a retry whenever `status === 'error'`.
        ---------------------------------------------------------------------- */
  useEffect(() => {
    console.log('[useErrorReconnect] status', status);
    console.log(
      '[useErrorReconnect] unmountedRef.current',
      unmountedRef.current,
    );
    // Bail out early if we’re not in an error state or the component is dead.
    if (status !== 'error' || unmountedRef.current) return;

    // Respect the max‑attempts limit (0 = infinite).
    const nextAttempt = attemptRef.current + 1;
    console.log('[useErrorReconnect] nextAttempt', nextAttempt);
    if (maxAttempts > 0 && nextAttempt > maxAttempts) {
      console.warn(
        `[useErrorReconnect] Max reconnection attempts (${maxAttempts}) reached – giving up.`,
      );
      return;
    }

    // ------- compute back‑off delay ---------------------------------------
    // exponential back‑off: baseDelay * 2^(attempt-1)
    const expoDelay = baseDelayMs * Math.pow(2, attemptRef.current);
    // add a small random jitter so that many clients don’t all retry at the
    // exact same millisecond.
    const jitter = Math.random() * jitterMs;
    const delay = attemptRef.current === 0 ? 0 : Math.round(expoDelay + jitter);

    // Store the new attempt count *before* we schedule the callback –
    // the callback may fire after the component has re‑rendered.
    attemptRef.current = nextAttempt;

    // Debug logging – remove or replace with your logger in prod.
    console.info(
      `[useErrorReconnect] Scheduling reconnect #${nextAttempt} in ${delay} ms`,
    );

    // ------- schedule the reconnection ------------------------------------
    timerRef.current = setTimeout(async () => {
      console.log('[useErrorReconnect] setTimeout with delay', delay);
      try {
        // Call the user‑provided `resumeStream`. If it succeeds the status
        // will change (to "loading" → then "complete") which causes the
        // first effect (reset) to fire and zero the attempt counter.
        await resumeStream();
        // If `resumeStream` resolves but the status is still "error" we’ll
        // get a new run of this effect because `status` didn’t change.
      } catch (err) {
        // Log the failure – we’ll simply wait for the next retry.
        console.error('[useErrorReconnect] resumeStream threw:', err);
        // The effect will re‑run because `status` is still "error".
      }
    }, delay);

    // Cleanup: cancel the timer if the effect re‑runs or the component unmounts.
    return clearTimer;
  }, [
    status,
    resumeStream,
    baseDelayMs,
    maxAttempts,
    jitterMs,
    clearTimer,
    // note: attemptRef isn’t a dependency – it’s a mutable ref.
  ]);

  /* ----------------------------------------------------------------------
        3️⃣  Component unmount – make sure we never try to update after it.
        ---------------------------------------------------------------------- */
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      clearTimer();
    };
  }, [clearTimer]);
}
