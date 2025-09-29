# Testing 60s Proxy Timeout Behavior

This document describes how to test the stream reconnection logic that handles Databricks Apps' 60-second proxy timeout.

## Background

When deployed to Databricks Apps, there's a proxy in front of the application that terminates HTTP connections after 60 seconds. This breaks long-running streaming responses from the AI SDK.

The solution uses client-side hooks (`useStreamReconnect` and `useStreamTiming`) to automatically detect timeout and resume the stream.

## Testing Approaches

### Option 1: Test Endpoint (Recommended)

Use the `/api/chat-test-timeout` endpoint which simulates the timeout behavior server-side.

**How to test:**

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Make a request to the test endpoint:
   ```bash
   curl -X POST http://localhost:3001/api/chat-test-timeout \
     -H "Content-Type: application/json" \
     -d '{"id": "test-1"}' \
     -N
   ```

3. Wait for the timeout (~65 seconds). You'll see chunks 1-7 stream, then the connection closes.

4. Resume the stream by making another request with the same ID:
   ```bash
   curl -X POST http://localhost:3001/api/chat-test-timeout \
     -H "Content-Type: application/json" \
     -d '{"id": "test-1"}' \
     -N
   ```

5. You should see chunks 8-11 stream to completion.

**To enable timeout simulation:**
Uncomment lines 73-81 in `app/(chat)/api/chat-test-timeout/route.ts`

**Pros:**
- Easy to control and repeat
- Server maintains state correctly
- No extra infrastructure needed

**Cons:**
- Doesn't test real proxy termination

---

### Option 2: Reverse Proxy (Real Simulation)

Use `proxy-timeout.js` to create a reverse proxy with a 60-second timeout.

**How to test:**

1. Install dependencies:
   ```bash
   npm install --save-dev http-proxy
   ```

2. Start the Next.js dev server (will run on :3001):
   ```bash
   npm run dev
   ```

3. In another terminal, start the timeout proxy (will run on :4000):
   ```bash
   node proxy-timeout.js
   ```

4. Access the application through the proxy:
   ```
   http://localhost:4000
   ```

5. Test with a long-running chat request. The proxy will terminate the connection after 60 seconds, and the client-side hooks should automatically reconnect.

**Pros:**
- Tests real proxy termination behavior
- Can test full app through browser

**Cons:**
- Requires running extra server
- More complex setup
- Must access app through different port

---

## Expected Behavior

When testing either approach, you should see:

1. **Initial Request:**
   - `[Stream Timing] 🚀 Request started`
   - `[Stream Timing] ⚡ First chunk received after XXXms (TTFB)`
   - Stream sends data...
   - After 60s: Connection closes (proxy timeout or simulated timeout)

2. **Automatic Reconnection (after 65s of inactivity):**
   - `[useStreamReconnect] Stream inactive for 65000ms, attempting reconnection (attempt 1/5)`
   - `[useStreamReconnect] Calling resumeStream()...`
   - `[Stream Timing] 🚀 Request started` (new request)
   - Stream resumes from where it left off

3. **Completion:**
   - `[Stream Timing] ✅ Stream completed in XXXms total`
   - All chunks received successfully

---

## Key Files

- `hooks/use-stream-reconnect.ts` - Detects timeout and calls `resumeStream()`
- `hooks/use-stream-timing.ts` - Logs streaming performance metrics
- `app/(chat)/api/chat-test-timeout/route.ts` - Test endpoint with timeout simulation
- `proxy-timeout.js` - Reverse proxy with 60s timeout
- `components/chat.tsx` - Integrates both hooks

---

## Troubleshooting

**Stream doesn't reconnect:**
- Check that `useStreamReconnect` hook is enabled in `components/chat.tsx`
- Verify `inactivityTimeout` is set to 65000ms (65 seconds)
- Check browser console for reconnection logs

**Proxy doesn't work:**
- Ensure Next.js is running on port 3001
- Check that `http-proxy` is installed
- Verify proxy is listening on port 4000

**Resume doesn't work:**
- For test endpoint: Check that timeout simulation is enabled
- For real endpoint: Ensure server maintains conversation state
- Verify the chat ID is the same across requests