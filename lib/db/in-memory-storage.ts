/**
 * In-memory storage for chats when database is not available
 * This is ephemeral and will be lost on server restart or refresh
 */

import type { Chat, User, DBMessage } from './schema';
import type { LanguageModelV2Usage } from '@ai-sdk/provider';

// In-memory stores
const users = new Map<string, User>();
const chats = new Map<string, Chat>();
const messages = new Map<string, DBMessage>();

export function getInMemoryUser(email: string): User | undefined {
  return users.get(email);
}

export function setInMemoryUser(user: User): User {
  users.set(user.email, user);
  return user;
}

export function createInMemoryUser(id: string, email: string): User {
  const user: User = { id, email };
  users.set(email, user);
  return user;
}

export function getInMemoryChats(userId: string): Chat[] {
  return Array.from(chats.values())
    .filter(chat => chat.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getInMemoryChat(id: string): Chat | undefined {
  return chats.get(id);
}

export function saveInMemoryChat(chat: Omit<Chat, 'id'> & { id?: string }): Chat {
  const id = chat.id || crypto.randomUUID();
  const fullChat: Chat = {
    id,
    createdAt: chat.createdAt,
    title: chat.title,
    userId: chat.userId,
    visibility: chat.visibility,
    lastContext: chat.lastContext
  };
  chats.set(id, fullChat);
  return fullChat;
}

export function deleteInMemoryChat(id: string): void {
  chats.delete(id);
  // Also delete associated messages
  for (const [messageId, message] of messages.entries()) {
    if (message.chatId === id) {
      messages.delete(messageId);
    }
  }
}

export function getInMemoryChatMessages(chatId: string): DBMessage[] {
  return Array.from(messages.values())
    .filter(message => message.chatId === chatId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function saveInMemoryMessage(message: Omit<DBMessage, 'id'> & { id?: string }): DBMessage {
  const id = message.id || crypto.randomUUID();
  const fullMessage: DBMessage = {
    id,
    chatId: message.chatId,
    role: message.role,
    parts: message.parts,
    attachments: message.attachments,
    createdAt: message.createdAt
  };
  messages.set(id, fullMessage);
  return fullMessage;
}

export function updateInMemoryChatTitle(id: string, title: string): void {
  const chat = chats.get(id);
  if (chat) {
    chat.title = title;
    chats.set(id, chat);
  }
}

export function updateInMemoryChatVisibility(id: string, visibility: 'public' | 'private'): void {
  const chat = chats.get(id);
  if (chat) {
    chat.visibility = visibility;
    chats.set(id, chat);
  }
}

export function updateInMemoryChatContext(id: string, context: LanguageModelV2Usage): void {
  const chat = chats.get(id);
  if (chat) {
    chat.lastContext = context;
    chats.set(id, chat);
  }
}