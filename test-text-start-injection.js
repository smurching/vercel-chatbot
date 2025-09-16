// Test the text-start injection logic with mock Databricks response data

// Mock Databricks SSE stream chunks
const mockChunks = [
  'data: {"type":"response.output_text.delta","item_id":"run-123","delta":"Hello","id":"abc"}\n\n',
  'data: {"type":"response.output_text.delta","item_id":"run-123","delta":" there!","id":"abc"}\n\n',
  'data: {"type":"response.output_text.delta","item_id":"run-123","delta":" How are you?","id":"abc"}\n\n',
  'data: {"type":"response.output_item.done","item":{"id":"run-123","content":[{"text":"Hello there! How are you?","type":"output_text"}],"role":"assistant","type":"message"},"id":"abc"}\n\n',
  'data: [DONE]\n\n'
];

// Simulate the text-start injection logic
function processStream(chunks) {
  const results = [];
  let hasInjectedTextStart = false;
  const textPartId = 'text-' + Math.random().toString(36).substr(2, 9);

  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ') && !line.includes('[DONE]')) {
        try {
          const data = JSON.parse(line.slice(6));

          // Check if this chunk contains content
          const content = data.choices?.[0]?.delta?.content ||
                        data.content ||
                        (data.type === "response.output_text.delta" ? data.delta : null);

          if (!hasInjectedTextStart && content) {
            console.log('✅ Injecting text-start event before content');
            const textStartEvent = {
              type: 'text-start',
              id: textPartId,
              providerMetadata: undefined
            };
            results.push(`data: ${JSON.stringify(textStartEvent)}\n\n`);
            hasInjectedTextStart = true;

            // Inject text-delta for this content
            const textDeltaEvent = {
              type: 'text-delta',
              id: textPartId,
              delta: content,
              providerMetadata: undefined
            };
            results.push(`data: ${JSON.stringify(textDeltaEvent)}\n\n`);
          } else if (content && hasInjectedTextStart) {
            const textDeltaEvent = {
              type: 'text-delta',
              id: textPartId,
              delta: content,
              providerMetadata: undefined
            };
            results.push(`data: ${JSON.stringify(textDeltaEvent)}\n\n`);
          } else if (!content) {
            results.push(line + '\n');
          }
        } catch (e) {
          results.push(line + '\n');
        }
      } else {
        results.push(line + '\n');
      }
    }
  }

  // Inject text-done event
  if (hasInjectedTextStart) {
    console.log('✅ Injecting text-done event');
    const textDoneEvent = {
      type: 'text-done',
      id: textPartId,
      providerMetadata: undefined
    };
    results.push(`data: ${JSON.stringify(textDoneEvent)}\n\n`);
  }

  return results;
}

console.log('🧪 Testing text-start injection logic...\n');

console.log('📥 Input chunks:');
mockChunks.forEach((chunk, i) => {
  console.log(`${i}: ${JSON.stringify(chunk)}`);
});

console.log('\n🔄 Processing...\n');

const processedChunks = processStream(mockChunks);

console.log('\n📤 Output chunks:');
processedChunks.forEach((chunk, i) => {
  console.log(`${i}: ${JSON.stringify(chunk)}`);
});

console.log('\n✅ Test completed!');