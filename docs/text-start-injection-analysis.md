# Text-Start Event Injection Analysis

## Problem
The Vercel AI SDK expects `text-start` events before `text-delta` events for proper streaming, but Databricks responses API only produces `text-delta`-equivalent events, causing "Cannot read properties of undefined (reading 'text')" errors.

## Root Cause Analysis

### 1. Databricks Response Format
Direct testing reveals Databricks responses API returns:
```
data: {"type":"response.output_text.delta","item_id":"run-123","delta":"Hello","id":"abc"}
```

**Key differences from OpenAI format:**
- Content is in `data.delta` (not `data.choices[0].delta.content`)
- Event type is `"response.output_text.delta"`
- No `text-start` events are generated

### 2. Original Detection Logic Issue
The original logic only checked for OpenAI format:
```javascript
const content = data.choices?.[0]?.delta?.content || data.content;
```

This missed Databricks format entirely.

## Solution Implementation

### 1. Enhanced Content Detection
Updated logic to handle both formats:
```javascript
const content = data.choices?.[0]?.delta?.content ||
              data.content ||
              (data.type === "response.output_text.delta" ? data.delta : null);
```

### 2. Improved Content-Type Detection
Expanded content-type matching for Databricks responses:
```javascript
if (contentType?.includes('text/plain') ||
    contentType?.includes('text/event-stream') ||
    contentType?.includes('application/x-ndjson') ||
    (contentType?.includes('text/') && response.body)) {
```

### 3. Event Injection Logic
The streaming processor now:
1. Detects first content chunk (Databricks format)
2. Injects `text-start` event before it
3. Converts all content to `text-delta` events
4. Preserves non-content events
5. Injects `text-done` event at end

## Verification

### Mock Test Results ✅
Created `test-text-start-injection.js` with real Databricks response data:

**Input:**
```
data: {"type":"response.output_text.delta","delta":"Hello","..."}
data: {"type":"response.output_text.delta","delta":" there!","..."}
```

**Output:**
```
data: {"type":"text-start","id":"text-xyz"}
data: {"type":"text-delta","id":"text-xyz","delta":"Hello"}
data: {"type":"text-delta","id":"text-xyz","delta":" there!"}
data: {"type":"text-done","id":"text-xyz"}
```

✅ **Confirmed:** Logic correctly detects and transforms Databricks format

## Current Status

### ✅ Completed
- [x] Root cause analysis of text-start injection failure
- [x] Updated content detection for Databricks response format
- [x] Enhanced content-type detection logic
- [x] Verified injection logic with mock data
- [x] Added comprehensive logging

### 🔄 In Progress
- [ ] End-to-end integration testing through chat API
- [ ] Verification that custom fetch function is being called
- [ ] Content-type header analysis from live Databricks responses

## Expected Outcome
The implementation should now properly inject `text-start` events before Databricks content, resolving the "Cannot read properties of undefined (reading 'text')" errors and enabling proper streaming display in the UI.

## Testing Commands
```bash
# Test logic with mock data
node test-text-start-injection.js

# Test Databricks API directly
curl -X POST "$DATABRICKS_HOST/serving-endpoints/responses" \
  -H "Authorization: Bearer $DATABRICKS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model": "'$DATABRICKS_AGENT_ENDPOINT'", "input": [{"role": "user", "content": "Hi"}], "stream": true}' \
  -N
```