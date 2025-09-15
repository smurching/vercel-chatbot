import {
  streamText,
  createUIMessageStream,
  JsonToSseTransformStream,
  convertToModelMessages
} from 'ai';
import { myProvider } from '@/lib/ai/providers';
import { generateUUID } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Test streaming endpoint received:', JSON.stringify(body, null, 2));

    // Accept both standard AI SDK format and responses API format
    let messages = body.messages || body.input || [];

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'No messages provided' }, { status: 400 });
    }

    // Test streamText with UI message stream like the main chat API
    console.log('Testing streamText with Databricks provider...');

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          model: myProvider.languageModel('chat-model'),
          messages: convertToModelMessages(messages),
          maxTokens: 1000,
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: false,
          }),
        );
      },
      generateId: generateUUID,
      onFinish: async () => {
        console.log('Stream finished');
      },
      onError: () => {
        return 'Error occurred during streaming!';
      },
    });

    // Return the stream like main chat API
    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));

  } catch (error) {
    console.error('Test streaming endpoint error:', error);
    return Response.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}