# Stream Resumption Implementation Attempts

## Problem Statement

Databricks Apps has a 60-second proxy timeout that terminates long-running HTTP connections. When streaming AI responses that take longer than 60 seconds, the connection is cut, but the backend continues processing. We need to:

1. Detect when the stream connection breaks
2. Reconnect and resume the stream
3. Avoid showing duplicate content in the UI

## Approaches Tried

### Attempt 1: Cursor-Based Pagination with Backend Tracking

**Approach:**
- Added `cursor` query parameter to `/api/chat/[id]/stream` endpoint
- Backend `subscribeToStream()` skips first N chunks based on cursor
- Client tracks cursor and passes it on reconnection

**Implementation:**
```typescript
// Backend: lib/stream-cache.ts
subscribeToStream(streamId: string, cursor: number = 0) {
  const chunksToReplay = cached.chunks.slice(cursor);
  // Replay only chunks after cursor position
}

// Client: components/chat.tsx
prepareReconnectToStreamRequest({ id }) {
  return {
    api: `/api/chat/${id}/stream?cursor=${cursorRef.current}`,
  };
}
```

**Problem:**
- **Mismatch between client parts and server chunks**: Client-side message parts don't map 1:1 to server-side SSE chunks
- Example:
  - Server sends: `start`, `start-step`, `text-start`, `text-delta`, `text-delta`, `text-end` (6 chunks)
  - Client sees: `step-start`, `text` (2 parts)
- Client has no accurate way to know how many server chunks it has received

**Variations Tried:**

#### 1a. Count client parts as cursor
```typescript
let totalParts = 0;
for (const msg of messages) {
  totalParts += msg.parts.length;
}
cursorRef.current = totalParts;
```
**Issue:** Client parts ≠ server chunks. Undercounts actual chunks received.

#### 1b. Track cursor in `onData` callback
```typescript
onData: (dataPart) => {
  cursorRef.current++;
}
```
**Issue:** `onData` only fires for certain chunk types (e.g., `data-usage`), NOT for `text-delta`, `tool-call-delta`, etc. Massive undercount of actual chunks.

#### 1c. Estimate server chunks from client parts
```typescript
for (const part of lastAssistantMsg.parts) {
  if (part.type === 'step-start') estimatedChunks += 1;
  else if (part.type === 'text') estimatedChunks += 3; // text-start + delta + end
  else if (part.type === 'tool-call') estimatedChunks += 3;
}
```
**Issue:** Fragile heuristics. Text parts can have many deltas. No way to know exact count.

**Conclusion:** Cannot accurately map client-side parts to server-side chunks without additional metadata from the AI SDK.

---

### Attempt 2: No Cursor - Rely on Full Replay + Client Deduplication

**Approach:**
- Remove cursor parameter entirely
- Backend replays ALL cached chunks on reconnection
- Client deduplicates on the frontend

**Variations Tried:**

#### 2a. Chunk ID tracking
```typescript
const seenChunkIds = useRef(new Set<string>());

onData: (dataPart) => {
  if ('id' in dataPart && dataPart.id) {
    if (seenChunkIds.current.has(dataPart.id)) {
      return; // Skip duplicate
    }
    seenChunkIds.current.add(dataPart.id);
  }
}
```
**Issue:** `onData` doesn't fire for text-delta chunks, so duplicate text still appears. Chunk IDs not available for all chunk types.

#### 2b. Step-start based deduplication
```typescript
// Find last 'step-start' marker and keep only content after it
const lastStepStartIndex = message.parts.findLastIndex(p => p.type === 'step-start');
message.parts = message.parts.slice(lastStepStartIndex);
```
**Issue:** `step-start` events occur in the middle of streams (e.g., between assistant text and tool calls), not just at replay boundaries. Incorrectly removes valid content.

#### 2c. Content length tracking
```typescript
const maxContentLengthSeen = useRef(0);

// If current content length < max seen, we're replaying
if (currentTextLength < maxContentLengthSeen.current) {
  // Truncate to max seen length
  truncatedParts = buildPartsUpToLength(maxContentLengthSeen.current);
}
```
**Issue:** Deduplication in `useEffect` runs AFTER render, causing screen to flash between duplicate and deduplicated states.

#### 2d. Content length tracking with `useMemo`
```typescript
const deduplicatedMessages = useMemo(() => {
  // Synchronously truncate to max seen length before render
}, [messages]);
```
**Issue:** Still shows duplicates because `resumeStream()` replays from the beginning. Each retry adds more duplicate content. Pattern: "ABC" → "ABC ABC" → "ABC ABC ABC"

**Conclusion:** Client-side deduplication is complex and causes visual artifacts. Hard to deduplicate perfectly without knowing what content is new vs replayed.

---

### Attempt 3: Disable Client Retry - Rely on Page Refresh Only

**Approach:**
- Remove automatic retry logic
- Let backend continue streaming and save to database
- User refreshes page to see complete response
- AI SDK's `resume: true` loads from DB on page load

**Implementation:**
```typescript
// Disabled retry in useEffect
// User must manually refresh to see full response
```

**Problem:**
- Poor UX - user has to manually refresh
- Stream continues in background but user sees incomplete response
- No live updates after timeout

**Conclusion:** Not acceptable for production. Users expect automatic recovery.

---

## Current State

After removing deduplication logic, we're back to the basic setup:
- Backend caches stream chunks in memory
- Client retries on error using `resumeStream()`
- Backend replays all cached chunks
- **Result: Massive duplicate content in UI**

## Key Findings

1. **AI SDK limitations:**
   - `onData` callback doesn't fire for all chunk types (text-delta, tool-call-delta missing)
   - Client parts are merged representations of multiple server chunks
   - No built-in deduplication mechanism
   - `resumeStream()` designed for page reload, not mid-stream reconnection

2. **Fundamental mismatch:**
   - Server operates on SSE chunks (granular: start, delta, delta, delta, end)
   - Client operates on message parts (coalesced: single text part with full content)
   - No reliable way to map between them

3. **Deduplication challenges:**
   - Server-side: Need accurate cursor (client can't provide it)
   - Client-side: Causes flashing, incomplete, or lost content

## Potential Solutions (Not Yet Implemented)

### Option A: Server-Side Deduplication with Message IDs
- Track message IDs on both client and server
- Client sends last message ID on reconnection
- Server replays from that message forward
- **Challenge:** Still need to handle partial message replay within a message

### Option B: WebSocket Instead of SSE
- Use WebSocket for bidirectional communication
- Server can track client's acknowledged position
- Client sends ACKs for received chunks
- **Challenge:** Databricks Apps/Vercel may not support WebSockets

### Option C: Accept Duplicates + Aggressive Client Deduplication
- Accept that duplicates will temporarily appear
- Use stable message IDs to deduplicate aggressively
- Hide flashing with CSS transitions
- **Challenge:** Complex client logic, potential data loss

### Option D: Hybrid Approach with Database Polling
- Stream until timeout
- After timeout, poll database for updates
- Show polled content instead of resumed stream
- **Challenge:** Delay between writes and polls, not truly "live"

### Option E: Track Byte Offsets
- Track byte count of SSE stream on both sides
- Client reports bytes received
- Server resumes from byte offset
- **Challenge:** Encoding issues, chunk boundaries

## Recommendation

Need to either:
1. Find a way to reliably track server-side chunk position from client
2. Accept that cursor-based pagination is not feasible with current AI SDK and implement robust client-side deduplication
3. Switch to a different streaming protocol (WebSocket) if supported
4. Accept page-refresh-only resumption for now (poor UX but functional)

Further investigation needed into AI SDK internals to see if there's metadata we can use for accurate cursor tracking.
