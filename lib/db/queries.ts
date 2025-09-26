import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  user,
  chat,
  type User,
  document,
  type Suggestion,
  suggestion,
  message,
  vote,
  type DBMessage,
  type Chat,
  stream,
} from './schema';
import type { ArtifactKind } from '@/components/artifact';
import { generateUUID } from '../utils';
import type { VisibilityType } from '@/components/visibility-selector';
import { ChatSDKError } from '../errors';
import type { LanguageModelV2Usage } from '@ai-sdk/provider';
import { getDb } from './oauth-postgres';
import { isDatabaseAvailable } from './connection';
import {
  getInMemoryUser,
  setInMemoryUser,
  createInMemoryUser,
  getInMemoryChats,
  getInMemoryChat,
  saveInMemoryChat,
  deleteInMemoryChat,
  getInMemoryChatMessages,
  saveInMemoryMessage,
  updateInMemoryChatTitle,
  updateInMemoryChatVisibility,
  updateInMemoryChatContext,
} from './in-memory-storage';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// Use OAuth-based connection if credentials are available, otherwise fall back to POSTGRES_URL
let db: ReturnType<typeof drizzle>;

if (isDatabaseAvailable()) {
  if (process.env.DATABRICKS_CLIENT_ID && process.env.DATABRICKS_CLIENT_SECRET) {
    // OAuth path - db will be initialized asynchronously
    console.log('Using OAuth authentication for Postgres connection');
  } else if (process.env.POSTGRES_URL) {
    // Traditional connection string
    const client = postgres(process.env.POSTGRES_URL);
    db = drizzle(client);
  }
} else {
  console.log('No database configured - using in-memory storage');
}

// Helper to ensure db is initialized for OAuth path
async function ensureDb() {
  if (!isDatabaseAvailable()) {
    throw new Error('Database not available - using in-memory storage');
  }

  if (!db && process.env.DATABRICKS_CLIENT_ID && process.env.DATABRICKS_CLIENT_SECRET) {
    console.log('[ensureDb] No db instance found, initializing OAuth connection...');
    try {
      db = await getDb();
      console.log('[ensureDb] OAuth db connection initialized successfully');
    } catch (error) {
      console.error('[ensureDb] Failed to initialize OAuth connection:', error);
      throw error;
    }
  }
  if (!db) {
    console.error('[ensureDb] DB is still null after initialization attempt!');
    throw new Error('Database connection could not be established');
  }
  return db;
}

export async function getUser(email: string): Promise<Array<User>> {
  if (!isDatabaseAvailable()) {
    const inMemoryUser = getInMemoryUser(email);
    return inMemoryUser ? [inMemoryUser] : [];
  }

  try {
    return await (await ensureDb()).select().from(user).where(eq(user.email, email));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user by email',
    );
  }
}

// createUser function removed - users are now created automatically via getOrCreateUserFromHeaders

// createGuestUser function removed - no guest users in Databricks-only auth mode

export async function getUserFromHeaders(request: Request): Promise<User> {
  // Check for Databricks Apps headers first
  const forwardedUser = request.headers.get('X-Forwarded-User');
  const forwardedEmail = request.headers.get('X-Forwarded-Email');
  const forwardedPreferredUsername = request.headers.get('X-Forwarded-Preferred-Username');

  let userIdentifier: string;
  let userEmail: string;

  if (forwardedUser) {
    // Databricks Apps environment - use forwarded headers
    userIdentifier = forwardedUser;
    userEmail = forwardedEmail || `${forwardedPreferredUsername}@databricks.com` || `${forwardedUser}@databricks.com`;
    console.log(`[getUserFromHeaders] Using Databricks Apps user: ${userIdentifier} (${userEmail})`);
  } else {
    // Local development - use system username
    const systemUsername = process.env.USER || process.env.USERNAME || 'local-user';
    userIdentifier = systemUsername;
    userEmail = `${systemUsername}@localhost`;
    console.log(`[getUserFromHeaders] Using local development user: ${userIdentifier} (${userEmail})`);
  }

  // Return user object with Databricks user ID - no database operations needed
  const user: User = {
    id: userIdentifier, // Use Databricks user ID directly
    email: userEmail,
  };

  console.log(`[getUserFromHeaders] Returning user from headers:`, user);
  return user;
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  if (!isDatabaseAvailable()) {
    console.log('[saveChat] Database not available - using in-memory storage');
    return saveInMemoryChat({ id, userId, title, visibility });
  }

  try {
    return await (await ensureDb()).insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (error) {
    console.error('[saveChat] Error saving chat:', error);
    throw new ChatSDKError('bad_request:database', 'Failed to save chat');
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await (await ensureDb()).delete(vote).where(eq(vote.chatId, id));
    await (await ensureDb()).delete(message).where(eq(message.chatId, id));
    await (await ensureDb()).delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await (await ensureDb())
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete chat by id',
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  if (!isDatabaseAvailable()) {
    console.log('[getChatsByUserId] Database not available - using in-memory storage');
    const inMemoryChats = getInMemoryChats(id);
    return {
      chats: inMemoryChats.slice(0, limit),
      hasMore: inMemoryChats.length > limit,
    };
  }

  try {
    console.log('[getChatsByUserId] Starting query with params:', { id, limit, startingAfter, endingBefore });

    const extendedLimit = limit + 1;

    const query = async (whereCondition?: SQL<any>) => {
      console.log('[getChatsByUserId] Ensuring DB connection...');
      const database = await ensureDb();
      console.log('[getChatsByUserId] DB connection established');

      return database
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);
    };

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      console.log('[getChatsByUserId] Fetching chat for startingAfter:', startingAfter);
      const database = await ensureDb();
      const [selectedChat] = await database
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${startingAfter} not found`,
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      console.log('[getChatsByUserId] Fetching chat for endingBefore:', endingBefore);
      const database = await ensureDb();
      const [selectedChat] = await database
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${endingBefore} not found`,
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      console.log('[getChatsByUserId] Executing main query without pagination');
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;
    console.log('[getChatsByUserId] Query successful, found', filteredChats.length, 'chats');

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    console.error('[getChatsByUserId] Error details:', error);
    console.error('[getChatsByUserId] Error stack:', error instanceof Error ? error.stack : 'No stack available');
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get chats by user id',
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  if (!isDatabaseAvailable()) {
    console.log('[getChatById] Database not available - using in-memory storage');
    return getInMemoryChat(id);
  }

  try {
    const [selectedChat] = await (await ensureDb()).select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  if (!isDatabaseAvailable()) {
    console.log('[saveMessages] Database not available - using in-memory storage');
    messages.forEach(msg => saveInMemoryMessage(msg));
    return;
  }

  try {
    return await (await ensureDb()).insert(message).values(messages);
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save messages');
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  if (!isDatabaseAvailable()) {
    console.log('[getMessagesByChatId] Database not available - using in-memory storage');
    return getInMemoryChatMessages(id);
  }

  try {
    return await (await ensureDb())
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get messages by chat id',
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await (await ensureDb())
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await (await ensureDb())
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await (await ensureDb()).insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to vote message');
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await (await ensureDb()).select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get votes by chat id',
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await (await ensureDb())
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save document');
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await (await ensureDb())
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get documents by id',
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await (await ensureDb())
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get document by id',
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await (await ensureDb())
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await (await ensureDb())
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete documents by id after timestamp',
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await (await ensureDb()).insert(suggestion).values(suggestions);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save suggestions',
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await (await ensureDb())
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get suggestions by document id',
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await (await ensureDb()).select().from(message).where(eq(message.id, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message by id',
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await (await ensureDb())
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await (await ensureDb())
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await (await ensureDb())
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete messages by chat id after timestamp',
    );
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await (await ensureDb()).update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update chat visibility by id',
    );
  }
}

export async function updateChatLastContextById({
  chatId,
  context,
}: {
  chatId: string;
  // Store raw LanguageModelUsage to keep it simple
  context: LanguageModelV2Usage;
}) {
  if (!isDatabaseAvailable()) {
    console.log('[updateChatLastContextById] Database not available - using in-memory storage');
    updateInMemoryChatContext(chatId, context);
    return;
  }

  try {
    return await (await ensureDb())
      .update(chat)
      .set({ lastContext: context })
      .where(eq(chat.id, chatId));
  } catch (error) {
    console.warn('Failed to update lastContext for chat', chatId, error);
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  if (!isDatabaseAvailable()) {
    console.log('[getMessageCountByUserId] Database not available - returning 0 count');
    return 0;
  }

  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000,
    );

    const [stats] = await (await ensureDb())
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, 'user'),
        ),
      )
      .execute();

    return stats?.count ?? 0;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message count by user id',
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  if (!isDatabaseAvailable()) {
    console.log('[createStreamId] Database not available - skipping stream ID creation');
    return;
  }

  try {
    await (await ensureDb())
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create stream id',
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await (await ensureDb())
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get stream ids by chat id',
    );
  }
}
