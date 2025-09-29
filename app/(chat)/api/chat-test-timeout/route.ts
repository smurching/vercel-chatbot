/**
 * Test endpoint that simulates a 60-second proxy timeout by:
 * 1. Starting to stream messages
 * 2. Artificially closing the connection after 60 seconds
 * 3. Allowing resumeStream() to pick up where it left off
 *
 * This simulates the Databricks Apps proxy 60s timeout behavior.
 */

// Track stream state across requests (for resume support)
const streamState = new Map<string, {
  currentChunk: number;
  startTime: number;
  hasSimulatedTimeout: boolean;
}>();

export async function POST(request: Request) {
  const body = await request.json();
  const chatId = body.id || 'default-test-id';

  console.log('[Test Timeout] Received request for chat:', chatId);

  // Get or create stream state
  let state = streamState.get(chatId);
  if (!state) {
    state = {
      currentChunk: 0,
      startTime: Date.now(),
      hasSimulatedTimeout: false,
    };
    streamState.set(chatId, state);
    console.log('[Test Timeout] New stream state created');
  } else {
    console.log('[Test Timeout] Resuming from chunk', state.currentChunk);
  }

  // Create a ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      try {
        console.log('[Test Timeout] Starting stream execution...');

        // All message chunks
        const messageParts = [
          'Chunk 1 (0s). ',
          'Chunk 2 (2s). ',
          'Chunk 3 (4s). ',
          'Chunk 4 (6s). ',
          'Chunk 5 (20s). ',
          'Chunk 6 (40s). ',
          'Chunk 7 (58s - last before timeout). ',
          // Connection will close here (60s timeout simulation)
          'Chunk 8 (after reconnect ~65s). ',
          'Chunk 9 (70s). ',
          'Chunk 10 (85s). ',
          'Final chunk - complete! ',
        ];

        const chunkDelays = [0, 2000, 2000, 2000, 14000, 20000, 18000, 7000, 5000, 15000, 5000];

        const requestStartTime = Date.now();
        const totalElapsedSinceFirst = (requestStartTime - state!.startTime) / 1000;

        console.log(`[Test Timeout] Total elapsed since first request: ${totalElapsedSinceFirst.toFixed(1)}s`);

        // Send chunks starting from current position
        for (let i = state!.currentChunk; i < messageParts.length; i++) {
          const elapsedThisRequest = (Date.now() - requestStartTime) / 1000;
          const totalElapsed = (Date.now() - state!.startTime) / 1000;

          // Simulate connection close after 60 seconds total elapsed time (only once)
          // DISABLED: Uncomment to test timeout simulation
          // if (i === 7 && !state!.hasSimulatedTimeout && totalElapsed >= 60) {
          //   console.log(`[Test Timeout] 🔌 SIMULATING CONNECTION CLOSE at ${totalElapsed.toFixed(1)}s (after chunk ${i})`);
          //   state!.currentChunk = i; // Save position (chunk 7 not yet sent)
          //   state!.hasSimulatedTimeout = true;
          //
          //   // Close the stream abruptly to simulate timeout
          //   controller.error(new Error('Connection closed by proxy timeout'));
          //   return;
          // }

          // Send chunk as SSE data
          const chunk = `data: ${messageParts[i]}\n\n`;
          controller.enqueue(new TextEncoder().encode(chunk));

          console.log(
            `[Test Timeout] ✓ Sent chunk ${i + 1}/${messageParts.length} ` +
            `(this request: ${elapsedThisRequest.toFixed(1)}s, total: ${totalElapsed.toFixed(1)}s)`
          );

          state!.currentChunk = i + 1;

          // Wait before next chunk
          if (i < messageParts.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, chunkDelays[i + 1]));
          }
        }

        console.log('[Test Timeout] ✅ Stream completed successfully');

        // Clean up state
        streamState.delete(chatId);

        // Send completion marker
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        console.error('[Test Timeout] ❌ Stream error:', error);
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}