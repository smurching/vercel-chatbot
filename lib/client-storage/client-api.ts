import { IndexedDBStorage } from './indexeddb-storage';
import type { Chat, DBMessage } from '@/lib/db/schema';
import type { VisibilityType } from '@/components/visibility-selector';
import type { ChatMessage } from '@/lib/types';
import { generateUUID } from '@/lib/utils';

export class ClientAPI {
  // Check if database is available via backend API
  static async isDatabaseAvailable(): Promise<boolean> {
    try {
      const response = await fetch('/api/database-status');
      const data = await response.json();
      return data.available;
    } catch {
      return false;
    }
  }

  // Chat operations
  static async saveChat(chat: {
    id: string;
    userId: string;
    title: string;
    visibility: VisibilityType;
  }) {
    const isDatabaseAvailable = await this.isDatabaseAvailable();

    if (isDatabaseAvailable) {
      // Use backend API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: chat.id,
          message: { id: generateUUID(), role: 'user', parts: [{ text: 'Initial chat' }] },
          selectedVisibilityType: chat.visibility,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save chat to backend');
      }

      return response.json();
    } else {
      // Use IndexedDB
      return await IndexedDBStorage.saveChat(chat);
    }
  }

  static async getChatById(id: string): Promise<Chat | null> {
    const isDatabaseAvailable = await this.isDatabaseAvailable();

    if (isDatabaseAvailable) {
      // Use backend API
      const response = await fetch(`/api/chat/${id}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Failed to get chat from backend');
      return response.json();
    } else {
      // Use IndexedDB
      return await IndexedDBStorage.getChatById(id);
    }
  }

  static async getChatsByUserId(
    userId: string,
    limit: number = 50
  ): Promise<{ chats: Chat[]; hasMore: boolean }> {
    const isDatabaseAvailable = await this.isDatabaseAvailable();

    if (isDatabaseAvailable) {
      // Use backend API
      const response = await fetch(`/api/history?limit=${limit}`);
      if (!response.ok) throw new Error('Failed to get chats from backend');
      return response.json();
    } else {
      // Use IndexedDB
      return await IndexedDBStorage.getChatsByUserId(userId, limit);
    }
  }

  static async deleteChatById(id: string) {
    const isDatabaseAvailable = await this.isDatabaseAvailable();

    if (isDatabaseAvailable) {
      // Use backend API
      const response = await fetch(`/api/chat?id=${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete chat from backend');
      return response.json();
    } else {
      // Use IndexedDB
      await IndexedDBStorage.deleteChatById(id);
      return { id };
    }
  }

  // Message operations
  static async saveMessages(messages: DBMessage[]) {
    const isDatabaseAvailable = await this.isDatabaseAvailable();

    if (isDatabaseAvailable) {
      // Backend will handle message saving via chat streaming
      return;
    } else {
      // Use IndexedDB
      await IndexedDBStorage.saveMessages(messages);
    }
  }

  static async getMessagesByChatId(chatId: string): Promise<DBMessage[]> {
    const isDatabaseAvailable = await this.isDatabaseAvailable();

    if (isDatabaseAvailable) {
      // Use backend API - typically messages are fetched with the chat
      const response = await fetch(`/api/chat/${chatId}/messages`);
      if (!response.ok) return [];
      return response.json();
    } else {
      // Use IndexedDB
      return await IndexedDBStorage.getMessagesByChatId(chatId);
    }
  }

  static async getMessageCountByUserId(
    userId: string,
    differenceInHours: number = 24
  ): Promise<number> {
    const isDatabaseAvailable = await this.isDatabaseAvailable();

    if (isDatabaseAvailable) {
      // This would be handled by backend rate limiting
      return 0;
    } else {
      // Use IndexedDB
      return await IndexedDBStorage.getMessageCountByUserId(userId, differenceInHours);
    }
  }

  // Utility methods
  static async clearStorage() {
    const isDatabaseAvailable = await this.isDatabaseAvailable();

    if (!isDatabaseAvailable) {
      await IndexedDBStorage.clear();
    }
  }

  // Chat streaming for IndexedDB mode
  static async createLocalChatStream(
    chatId: string,
    messages: ChatMessage[],
    userId: string
  ): Promise<ReadableStream> {
    // For local mode, we'll create a simple response stream
    // This is a simplified implementation - in a real app you might want to integrate with local LLM

    const encoder = new TextEncoder();

    return new ReadableStream({
      start(controller) {
        // Save user message
        const userMessage: DBMessage = {
          id: messages[messages.length - 1].id,
          chatId,
          role: 'user',
          parts: messages[messages.length - 1].parts,
          createdAt: new Date(),
          attachments: [],
        };

        IndexedDBStorage.saveMessages([userMessage]);

        // Create a simple assistant response
        const assistantMessage: DBMessage = {
          id: generateUUID(),
          chatId,
          role: 'assistant',
          parts: [{
            text: "I'm running in offline mode using local storage. Database connection is not available, so your conversations are stored locally in your browser."
          }],
          createdAt: new Date(),
          attachments: [],
        };

        // Stream the response
        const response = JSON.stringify({
          type: 'text-delta',
          textDelta: assistantMessage.parts[0].text,
        });

        controller.enqueue(encoder.encode(`data: ${response}\n\n`));

        // Save assistant message
        IndexedDBStorage.saveMessages([assistantMessage]);

        // End the stream
        controller.close();
      },
    });
  }
}