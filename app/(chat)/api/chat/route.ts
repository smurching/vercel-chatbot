import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type LanguageModelUsage,
  stepCountIs,
  streamText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { authFromHeaders, shouldUseHeaderAuth } from '@/lib/auth-headers';
import type { RequestHints } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { updateChatLastContextById } from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';
import {
  DATABRICKS_TOOL_CALL_ID,
  DATABRICKS_TOOL_DEFINITION,
} from '@/lib/databricks-tool-calling';

export const maxDuration = 60;

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  console.log('CHAT POST REQUEST');

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

    let session;

    if (shouldUseHeaderAuth(request)) {
      // Use header-based auth for Databricks Apps or local dev
      session = await authFromHeaders(request);
    } else {
      // Fall back to NextAuth for other environments
      session = await auth();
    }

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

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

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

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    let finalUsage: LanguageModelUsage | undefined;

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        const model = await myProvider.languageModel(selectedChatModel);
        const result = streamText({
          model,
          // TODO(smurching): conditionally include system prompt? It seems to break
          // Agent Bricks KA endpoints
          // system: systemPrompt({ selectedChatModel, requestHints }),
          messages: convertToModelMessages(uiMessages),
          // stopWhen: stepCountIs(5),
          onFinish: ({ usage }) => {
            finalUsage = usage;
            dataStream.write({ type: 'data-usage', data: usage });
          },
          includeRawChunks: true,
          tools: {
            [DATABRICKS_TOOL_CALL_ID]: DATABRICKS_TOOL_DEFINITION,
          },
        });

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
            sendSources: true,
          }),
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((message) => ({
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
      },
      onError: (error) => {
        console.error('Stream error:', error);
        console.error(
          'Stack trace:',
          error instanceof Error ? error.stack : 'No stack',
        );
        return 'Oops, an error occurred!';
      },
    });

    // Return the stream as a response
    return createUIMessageStreamResponse({
      stream,
      status: 200,
      statusText: 'OK',
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

  let session;

  if (shouldUseHeaderAuth(request)) {
    // Use header-based auth for Databricks Apps or local dev
    session = await authFromHeaders(request);
  } else {
    // Fall back to NextAuth for other environments
    session = await auth();
  }

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
