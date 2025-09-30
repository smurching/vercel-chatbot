import {
  convertToModelMessages,
  type LanguageModelUsage,
  streamText,
} from 'ai';
import {
  getAuthSession,
  type UserType,
} from '@/databricks/auth/databricks-auth';
import {
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/databricks/db/queries';
import { updateChatLastContextById } from '@/databricks/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';
import {
  DATABRICKS_TOOL_CALL_ID,
  DATABRICKS_TOOL_DEFINITION,
} from '@/databricks/stream-transformers/databricks-tool-calling';
import { streamCache } from '@/lib/stream-cache';

export const maxDuration = 60;

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  console.log('CHAT POST REQUEST ' + Date.now());

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
    } = requestBody;

    const session = await getAuthSession(request);

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    // Clear any previous active stream for this chat
    streamCache.clearActiveStream(id);

    let finalUsage: LanguageModelUsage | undefined;
    const streamId = generateUUID();

    const model = await myProvider.languageModel(selectedChatModel);
    const result = streamText({
      model,
      messages: convertToModelMessages(uiMessages),
      onFinish: ({ usage }) => {
        finalUsage = usage;
      },
      // We use raw chunks to pick the tool results out of the stream
      includeRawChunks: true,
      tools: {
        [DATABRICKS_TOOL_CALL_ID]: DATABRICKS_TOOL_DEFINITION,
      },
    });

    return result.toUIMessageStreamResponse({
      originalMessages: uiMessages,
      generateMessageId: generateUUID,
      sendReasoning: true,
      sendSources: true,
      onData: (dataPart) => {
        if (dataPart.type === 'finish' && finalUsage) {
          // Send usage data to client
          return { type: 'data-usage', data: finalUsage };
        }
      },
      onFinish: async ({ messages }) => {
        console.log('Finished message stream! Saving messages...');
        // Only save assistant messages - user message was already saved above
        const assistantMessages = messages.filter(m => m.role === 'assistant');
        await saveMessages({
          messages: assistantMessages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });

        if (finalUsage) {
          try {
            await updateChatLastContextById({
              chatId: id,
              context: finalUsage,
            });
          } catch (err) {
            console.warn('Unable to persist last usage for chat', id, err);
          }
        }

        // Mark stream as complete and remove from cache
        streamCache.completeStream(streamId);
      },
      onError: (error) => {
        console.error('Stream error:', error);
        console.error(
          'Stack trace:',
          error instanceof Error ? error.stack : 'No stack',
        );

        // Clean up stream on error
        streamCache.completeStream(streamId);

        return 'Oops, an error occurred!';
      },
      async consumeSseStream({ stream: sseStream }) {
        // Cache each chunk of the SSE stream for resumption
        // This runs in the background and doesn't block the response
        const reader = sseStream.getReader();

        // Start reading in the background (don't await)
        (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                console.log(`[StreamCache] Finished caching stream ${streamId}`);
                break;
              }

              // Store the raw chunk in the stream cache
              console.log(`[StreamCache] Caching chunk for stream`, streamId);
              streamCache.storeChunk(streamId, id, value);
            }
          } catch (error) {
            console.error(`[StreamCache] Error caching stream ${streamId}:`, error);
          } finally {
            reader.releaseLock();
          }
        })();
      },
    });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    console.error('Unhandled error in chat API:', error);
    console.error(
      'Stack trace:',
      error instanceof Error ? error.stack : 'No stack available',
    );
    return new ChatSDKError('offline:chat').toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await getAuthSession(request);

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
