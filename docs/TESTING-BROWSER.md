# Testing Stream Resumption in Browser

## Setup

1. **Terminal 1**: Start Next.js dev server
   ```bash
   npm run dev
   # Runs on localhost:3000
   ```

2. **Terminal 2**: Start the 5s timeout proxy
   ```bash
   node proxy-timeout.js
   # Runs on localhost:4000
   # Terminates connections after 5 seconds
   ```

## Testing Steps

### 1. Open Browser DevTools

1. Open Chrome/Firefox DevTools (F12)
2. Go to the **Console** tab
3. Go to the **Network** tab and filter for "Fetch/XHR"

### 2. Access App Through Proxy

**IMPORTANT**: Must use the proxy URL
```
http://localhost:4000
```

NOT `localhost:3000` (this bypasses the timeout proxy)

### 3. Start a Chat

Create a new chat or open an existing one, then send a message that will take >5 seconds to stream:

**Good test prompts**:
- "Count to 100 slowly, with one number per line"
- "Write a detailed 1000-word essay about machine learning"
- "Explain quantum computing in great detail"

### 4. Watch for Timeout and Resumption

#### What You Should See

**In Browser (first 0-5 seconds)**:
- Message starts streaming normally
- You see tokens appearing word-by-word
- Network tab shows active request to `/api/chat`

**At ~5 seconds - Proxy Timeout**:
- Network request shows as "failed" or "canceled"
- Streaming stops
- Network tab may show red status

**At ~6-7 seconds - Automatic Resumption**:
- New network request appears: `GET /api/chat/{chatId}/stream`
- Streaming resumes
- You continue to see new tokens appearing
- Message completes successfully

#### Console Logs to Watch For

**During initial stream**:
```
[Stream Timing] 🚀 Request started
[Stream Timing] ⚡ First chunk received after XXms (TTFB)
[useStreamReconnect] Stream inactive for 65000ms, attempting reconnection
```

**During reconnection**:
```
[useStreamReconnect] Calling resumeStream()...
[Stream Timing] 🚀 Request started
```

**On success**:
```
[Stream Timing] ✅ Stream completed
```

### 5. Check Server Logs

In Terminal 1 (Next.js server), you should see:

**On initial request**:
```
CHAT POST REQUEST {timestamp}
[StreamCache] Cleared active stream for chat {chatId}
[StreamCache] Created new stream {streamId} for chat {chatId}
```

**During streaming**:
```
[StreamCache] Finished caching stream {streamId}
```

**On resume request**:
```
[Stream Resume] GET request for chat {chatId}
[Stream Resume] Resuming stream {streamId} with N chunks
[Stream Resume] Sent N chunks for stream {streamId}
```

**On completion**:
```
[StreamCache] Completed and removed stream {streamId}
```

## Debugging

### Issue: GET /stream returns 204 No Content

This means the stream cache doesn't have an active stream.

**Possible causes**:
1. `consumeSseStream` never ran → Check for errors in server logs
2. Stream completed before timeout → Try a longer prompt
3. Chat ID mismatch → Check the chat ID in the URL matches the request

**Debug steps**:
1. Add temporary log in `consumeSseStream`:
   ```typescript
   console.log('[DEBUG] consumeSseStream called for stream:', streamId, 'chat:', id);
   ```

2. Check stream cache stats - add to `/api/chat/[id]/stream/route.ts`:
   ```typescript
   console.log('[DEBUG] Cache stats:', streamCache.getStats());
   ```

### Issue: Stream doesn't resume automatically

**Check 1**: Is `resume: true` enabled?
- Look in `components/chat.tsx` for `resume: true` in useChat config

**Check 2**: Is `useStreamReconnect` working?
- Should see console logs after 65 seconds of inactivity
- Check browser console for `[useStreamReconnect]` messages

**Check 3**: Are you accessing through the proxy?
- URL must be `localhost:4000`, not `localhost:3000`
- Check proxy logs in Terminal 2

### Issue: Infinite reconnection loop

This would mean the resume endpoint keeps finding an active stream that never completes.

**Debug**:
1. Check if `completeStream()` is being called in `onFinish`
2. Check if stream is actually completing (look for `[StreamCache] Finished caching` log)
3. Check stream cache TTL - streams should expire after 5 minutes

### Issue: Resumed stream is incomplete

**Possible causes**:
1. Chunks arriving after cache starts reading
2. Race condition in chunk storage

**Check**:
- Look for `[StreamCache] Finished caching` BEFORE the resume request
- If caching finishes after resume, that's the issue

## What Success Looks Like

✅ **Perfect resumption flow**:
1. Start typing a long message
2. Submit and see streaming start
3. At 5 seconds, stream stops (proxy timeout)
4. ~1-2 seconds later, streaming resumes automatically
5. Full message appears with no gaps
6. No user interaction required

✅ **Console logs show**:
- Stream timing logs
- Reconnection attempt
- Resume endpoint called
- Stream completed

✅ **Network tab shows**:
- Initial POST to `/api/chat` (failed/canceled at 5s)
- Automatic GET to `/api/chat/{id}/stream` (succeeded)

## Tips

- **Use longer prompts**: Short responses might complete before the 5s timeout
- **Monitor both consoles**: Browser console AND server logs
- **Check Network timing**: Use Network tab's timing column to see the 5s cutoff
- **Test multiple times**: First test might behave differently due to cold start

## For Production Testing

When ready to test with the real 60-second timeout:

1. Change `proxy-timeout.js`:
   ```javascript
   const TIMEOUT_MS = 60000; // Back to 60 seconds
   ```

2. Use prompts that take 60+ seconds:
   - "Write a 2000-word detailed analysis of..."
   - "Explain every concept in computer science..."

3. Wait longer for reconnection (will happen around 65-70 seconds)