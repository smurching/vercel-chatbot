import { NextRequest } from 'next/server';
import { myProvider } from '@/lib/ai/providers';
import { generateText, streamText } from 'ai';

export async function GET(request: NextRequest) {
  try {
    console.log('=== STREAM DEBUG TEST ===');

    // Test the Databricks model directly with streamText
    const result = streamText({
      model: myProvider.languageModel('chat-model'),
      messages: [
        { role: 'user', content: 'Say hello and count to 3.' }
      ],
    });

    console.log('streamText call completed, returning stream...');

    // Convert to response and log each chunk
    const response = result.toDataStreamResponse();

    // Create a logging wrapper
    if (response.body) {
      const [loggingStream, responseStream] = response.body.tee();

      // Log chunks in background
      (async () => {
        const reader = loggingStream.getReader();
        const decoder = new TextDecoder();
        let chunkIndex = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          console.log(`Stream chunk ${chunkIndex++}:`, JSON.stringify(chunk));
        }

        console.log('=== STREAM COMPLETE ===');
      })();

      return new Response(responseStream, {
        headers: response.headers,
        status: response.status
      });
    }

    return response;
  } catch (error) {
    console.error('Error in stream debug test:', error);
    return Response.json({ error: 'Failed to stream' }, { status: 500 });
  }
}