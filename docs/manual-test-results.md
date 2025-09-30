This is what I see in server logs when I try to use the proxy:

```
✓ Compiled /api/chat in 255ms
CHAT POST REQUEST 1759200838470
[getAuthSession] Using SCIM API for local development
[getDatabricksCurrentUser] Using cached SCIM user data (expires in 1745 seconds)
[getUserFromHeaders] Using Databricks Apps user: 5041460813056051 (sid.murching@databricks.com)
[getUserFromHeaders] Returning user from headers: { id: '5041460813056051', email: 'sid.murching@databricks.com' }
[ensureDb] Getting CLI-based OAuth U2M database connection...
[getSchemaName] Using hardcoded schema: ai_chatbot
[DB Pool] Set search_path to include schema 'ai_chatbot'
[ensureDb] CLI-based OAuth U2M db connection obtained successfully
[ensureDb] Getting CLI-based OAuth U2M database connection...
[getSchemaName] Using hardcoded schema: ai_chatbot
[DB Pool] Set search_path to include schema 'ai_chatbot'
[ensureDb] CLI-based OAuth U2M db connection obtained successfully
Creating fresh model for title-model
Creating new OAuth provider
Databricks request: {"url":"https://e2-dogfood.staging.cloud.databricks.com/serving-endpoints/chat/completions","method":"POST","body":{"model":"databricks-meta-llama-3-3-70b-instruct","messages":[{"role":"system","content":"\n\n    - you will generate a short title based on the first message a user begins a conversation with\n    - ensure it is not more than 80 characters long\n    - the title should be a summary of the user's message\n    - do not use quotes or colons. do not include other expository content (\"I'll help...\")"},{"role":"user","content":"{\"id\":\"61affd3a-75a4-4eaf-9122-ebb85e3bde80\",\"role\":\"user\",\"parts\":[{\"type\":\"text\",\"text\":\"How can you help me?\"}]}"}]}}
[ensureDb] Getting CLI-based OAuth U2M database connection...
[getSchemaName] Using hardcoded schema: ai_chatbot
[DB Pool] Set search_path to include schema 'ai_chatbot'
[ensureDb] CLI-based OAuth U2M db connection obtained successfully
[ensureDb] Getting CLI-based OAuth U2M database connection...
[getSchemaName] Using hardcoded schema: ai_chatbot
[DB Pool] Set search_path to include schema 'ai_chatbot'
[ensureDb] CLI-based OAuth U2M db connection obtained successfully
[ensureDb] Getting CLI-based OAuth U2M database connection...
[getSchemaName] Using hardcoded schema: ai_chatbot
[DB Pool] Set search_path to include schema 'ai_chatbot'
[ensureDb] CLI-based OAuth U2M db connection obtained successfully
Creating fresh model for chat-model
Using cached OAuth provider
Databricks request: {"url":"https://e2-dogfood.staging.cloud.databricks.com/serving-endpoints/responses","method":"POST","body":{"model":"ka-3032755f-endpoint","input":[{"role":"user","content":[{"type":"input_text","text":"How can you help me?"}]}],"stream":true}}
```

And after two minutes (the endpoint I'm querying is hardcoded to sleep for 2 min), I start to see chunks streamed:

```
🔍 Streaming response detected, adding raw chunk logging...
writing chunk {
  "type": "stream-start",
  "warnings": []
}
🔍 RAW DATABRICKS CHUNK: {
  "type": "response.output_text.delta",
  "item_id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": "<think>",
  "id": "f78ebc08-9ee4-4284-9cc7-d92e08905d12"
}
writing chunk {
  "type": "text-start",
  "id": "8df43628-5170-43cf-ab67-4b011243a8ba"
}
writing chunk {
  "type": "text-delta",
  "id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": "<think>"
}
🔍 RAW DATABRICKS CHUNK: {
  "type": "response.output_text.delta",
  "item_id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": "The",
  "id": "f78ebc08-9ee4-4284-9cc7-d92e08905d12"
}
writing chunk {
  "type": "text-delta",
  "id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": "The"
}
🔍 RAW DATABRICKS CHUNK: {
  "type": "response.output_text.delta",
  "item_id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " user",
  "id": "f78ebc08-9ee4-4284-9cc7-d92e08905d12"
}
writing chunk {
  "type": "text-delta",
  "id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " user"
}
🔍 RAW DATABRICKS CHUNK: {
  "type": "response.output_text.delta",
  "item_id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " has",
  "id": "f78ebc08-9ee4-4284-9cc7-d92e08905d12"
}
writing chunk {
  "type": "text-delta",
  "id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " has"
}
🔍 RAW DATABRICKS CHUNK: {
  "type": "response.output_text.delta",
  "item_id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " asked",
  "id": "f78ebc08-9ee4-4284-9cc7-d92e08905d12"
}
writing chunk {
  "type": "text-delta",
  "id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " asked"
}
🔍 RAW DATABRICKS CHUNK: {
  "type": "response.output_text.delta",
  "item_id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " \"",
  "id": "f78ebc08-9ee4-4284-9cc7-d92e08905d12"
}
writing chunk {
  "type": "text-delta",
  "id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " \""
}
🔍 RAW DATABRICKS CHUNK: {
  "type": "response.output_text.delta",
  "item_id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": "How",
  "id": "f78ebc08-9ee4-4284-9cc7-d92e08905d12"
}
writing chunk {
  "type": "text-delta",
  "id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": "How"
}
🔍 RAW DATABRICKS CHUNK: {
  "type": "response.output_text.delta",
  "item_id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " can",
  "id": "f78ebc08-9ee4-4284-9cc7-d92e08905d12"
}
writing chunk {
  "type": "text-delta",
  "id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " can"
}
🔍 RAW DATABRICKS CHUNK: {
  "type": "response.output_text.delta",
  "item_id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " you",
  "id": "f78ebc08-9ee4-4284-9cc7-d92e08905d12"
}
writing chunk {
  "type": "text-delta",
  "id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " you"
}
🔍 RAW DATABRICKS CHUNK: {
  "type": "response.output_text.delta",
  "item_id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " help",
  "id": "f78ebc08-9ee4-4284-9cc7-d92e08905d12"
}
writing chunk {
  "type": "text-delta",
  "id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " help"
}
🔍 RAW DATABRICKS CHUNK: {
  "type": "response.output_text.delta",
  "item_id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " me",
  "id": "f78ebc08-9ee4-4284-9cc7-d92e08905d12"
}
writing chunk {
  "type": "text-delta",
  "id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " me"
}
🔍 RAW DATABRICKS CHUNK: {
  "type": "response.output_text.delta",
  "item_id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": "?\"",
  "id": "f78ebc08-9ee4-4284-9cc7-d92e08905d12"
}
writing chunk {
  "type": "text-delta",
  "id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": "?\""
}
🔍 RAW DATABRICKS CHUNK: {
  "type": "response.output_text.delta",
  "item_id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " and",
  "id": "f78ebc08-9ee4-4284-9cc7-d92e08905d12"
}
writing chunk {
  "type": "text-delta",
  "id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " and"
}
🔍 RAW DATABRICKS CHUNK: {
  "type": "response.output_text.delta",
  "item_id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " the",
  "id": "f78ebc08-9ee4-4284-9cc7-d92e08905d12"
}
writing chunk {
  "type": "text-delta",
  "id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " the"
}
🔍 RAW DATABRICKS CHUNK: {
  "type": "response.output_text.delta",
  "item_id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " possible",
  "id": "f78ebc08-9ee4-4284-9cc7-d92e08905d12"
}
writing chunk {
  "type": "text-delta",
  "id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " possible"
}
🔍 RAW DATABRICKS CHUNK: {
  "type": "response.output_text.delta",
  "item_id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " sources",
  "id": "f78ebc08-9ee4-4284-9cc7-d92e08905d12"
}
writing chunk {
  "type": "text-delta",
  "id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " sources"
}
🔍 RAW DATABRICKS CHUNK: {
  "type": "response.output_text.delta",
  "item_id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " are",
  "id": "f78ebc08-9ee4-4284-9cc7-d92e08905d12"
}
writing chunk {
  "type": "text-delta",
  "id": "8df43628-5170-43cf-ab67-4b011243a8ba",
  "delta": " are"
}
...
```

In the proxy I don't see any attempts to resume the stream:

```
[Proxy] GET /_next/static/chunks/app_(chat)_page_tsx_118410cd._.js
[Proxy] GET /api/chat/a1f950e7-75cf-4551-a960-cfaa32da2770/stream
[Proxy] GET /api/chat/a1f950e7-75cf-4551-a960-cfaa32da2770/stream
[Proxy] GET /__nextjs_font/geist-mono-latin.woff2
[Proxy] POST /api/chat
[Proxy] ⏱️  Connection timeout after 10000ms for /api/chat
[Proxy] Connection closed by proxy for /api/chat
```