# Testing Stream Resumption with 5s Proxy Timeout

This document describes how to test the in-memory stream resumption implementation with the 5-second proxy timeout.

## Setup

The implementation includes:
- **In-memory stream cache** (`lib/stream-cache.ts`) - Stores stream chunks without Redis
- **POST /api/chat** - Modified to cache outgoing SSE streams
- **GET /api/chat/[id]/stream** - Resume endpoint that replays cached chunks
- **chat.tsx** - Updated with `resume: true` option
- **proxy-timeout.js** - Set to 5 second timeout for faster testing

## How to Test

### 1. Start the servers

Terminal 1 - Start Next.js dev server:
```bash
npm run dev
# Runs on localhost:3000
```

Terminal 2 - Start the timeout proxy:
```bash
node proxy-timeout.js
# Runs on localhost:4000, proxies to localhost:3000
# Terminates connections after 5 seconds
```

### 2. Access the app through the proxy

Open your browser to:
```
http://localhost:4000
```

**Important**: You MUST access the app through the proxy (port 4000), not directly (port 3000), to test the timeout behavior.

### 3. Start a chat that takes >5 seconds

Send a message that will generate a long response, for example:
- "Tell me a long story"
- "Explain quantum physics in detail"
- "Write a comprehensive guide to React"

### 4. Observe the behavior

**Expected behavior:**

1. **Initial stream (0-5s)**:
   - Message starts streaming normally
   - You see the response being generated
   - Stream cache logs appear: `[StreamCache] Created new stream {streamId} for chat {chatId}`

2. **At 5 seconds - Proxy timeout**:
   - Proxy terminates the connection
   - Proxy logs: `[Proxy] ⏱️  Connection timeout after 5000ms`
   - Browser console may show network error

3. **Automatic resumption (~6-7s)**:
   - Client's `resume` option triggers GET request to `/api/chat/{id}/stream`
   - Resume endpoint logs: `[Stream Resume] Resuming stream {streamId} with N chunks`
   - Stream continues from where it left off
   - You see the rest of the response appear

4. **Stream completion**:
   - When generation finishes, stream cache cleans up
   - Logs: `[StreamCache] Completed and removed stream {streamId}`

### 5. Browser Console Logs

You should see logs like:
```
[Stream Timing] 🚀 Request started
[Stream Timing] ⚡ First chunk received after XXXms (TTFB)
[useStreamReconnect] Stream inactive for 65000ms, attempting reconnection (attempt 1/5)
[useStreamReconnect] Calling resumeStream()...
[Stream Timing] 🚀 Request started (reconnection)
[Stream Timing] ✅ Stream completed
```

### 6. Server Console Logs

You should see logs like:
```
CHAT POST REQUEST {timestamp}
[StreamCache] Cleared active stream for chat {chatId}
[StreamCache] Created new stream {streamId} for chat {chatId}
[Stream Resume] GET request for chat {chatId}
[Stream Resume] Resuming stream {streamId} with N chunks
[StreamCache] Completed and removed stream {streamId}
```

## Troubleshooting

### Stream doesn't resume

**Check 1: Are you accessing through the proxy?**
- URL should be `http://localhost:4000`, not `localhost:3000`

**Check 2: Is the proxy running?**
```bash
curl -I http://localhost:4000
```

**Check 3: Check stream cache stats**
Add this to your code temporarily:
```typescript
console.log('[Debug] Stream cache stats:', streamCache.getStats());
```

### Connection closes but no resumption

**Check 1: Is `resume: true` set in useChat?**
Look for this in `components/chat.tsx`:
```typescript
resume: true, // Should be present
```

**Check 2: Check browser console**
Look for `useStreamReconnect` logs. If missing, the hook may not be working.

**Check 3: Check resume endpoint**
```bash
curl http://localhost:4000/api/chat/{some-chat-id}/stream
# Should return 204 if no active stream
# Or 200 with stream data if active
```

### Proxy not timing out

**Check proxy timeout setting**:
```javascript
// In proxy-timeout.js
const TIMEOUT_MS = 5000; // Should be 5000 (5 seconds)
```

### Stream cache fills up

The cache automatically expires streams after 5 minutes. Check logs for:
```
[StreamCache] Expired stream {streamId}
[StreamCache] Cleaned up N expired streams
```

## Testing with cURL

You can also test the proxy timeout behavior with cURL:

```bash
# This should timeout after 5 seconds
curl 'http://localhost:4000/api/chat-test-timeout' \
  -H 'Content-Type: application/json' \
  --data-raw '{"id":"test-1"}' \
  -N

# Should see:
# data: Chunk 1 (0s).
# data: Chunk 2 (2s).
# curl: (18) transfer closed with outstanding read data remaining
```

## Implementation Notes

- **No Redis required**: Uses in-memory Map for stream storage
- **TTL**: Streams expire after 5 minutes of inactivity
- **Single instance only**: This implementation doesn't work across multiple server instances
- **Memory usage**: Each active stream stores all chunks in memory
- **Cleanup**: Automatic cleanup runs every 60 seconds

## For Production

When deploying to production with the real 60-second timeout:

1. Change proxy timeout back to 60s in `proxy-timeout.js`:
   ```javascript
   const TIMEOUT_MS = 60000;
   ```

2. Or remove the proxy entirely since Databricks Apps already has the 60s timeout

3. Consider the following for production:
   - Monitor memory usage for stream cache
   - Adjust TTL based on your use case
   - Consider using Redis if you need distributed deployment
   - Add metrics/monitoring for stream resumption success rate