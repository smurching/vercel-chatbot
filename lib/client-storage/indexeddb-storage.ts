import type { Chat, DBMessage } from '@/lib/db/schema';
import type { VisibilityType } from '@/components/visibility-selector';

let dbInstance: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (!dbInstance) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('chatbot-storage', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        dbInstance = request.result;
        resolve(dbInstance);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create chats store
        if (!db.objectStoreNames.contains('chats')) {
          const chatsStore = db.createObjectStore('chats', { keyPath: 'id' });
          chatsStore.createIndex('by-userId', 'userId', { unique: false });
          chatsStore.createIndex('by-createdAt', 'createdAt', { unique: false });
        }

        // Create messages store
        if (!db.objectStoreNames.contains('messages')) {
          const messagesStore = db.createObjectStore('messages', { keyPath: 'id' });
          messagesStore.createIndex('by-chatId', 'chatId', { unique: false });
          messagesStore.createIndex('by-createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }
  return dbInstance;
}

export class IndexedDBStorage {
  // Chat operations
  static async saveChat(chat: {
    id: string;
    userId: string;
    title: string;
    visibility: VisibilityType;
  }): Promise<Chat> {
    const db = await getDB();
    const chatData: Chat = {
      ...chat,
      createdAt: new Date(),
      lastContext: null,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['chats'], 'readwrite');
      const store = transaction.objectStore('chats');
      const request = store.put(chatData);

      request.onsuccess = () => resolve(chatData);
      request.onerror = () => reject(request.error);
    });
  }

  static async getChatById(id: string): Promise<Chat | null> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['chats'], 'readonly');
      const store = transaction.objectStore('chats');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  static async getChatsByUserId(
    userId: string,
    limit: number = 50
  ): Promise<{ chats: Chat[]; hasMore: boolean }> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['chats'], 'readonly');
      const store = transaction.objectStore('chats');
      const index = store.index('by-userId');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        const allChats = request.result as Chat[];
        const sortedChats = allChats.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        const hasMore = sortedChats.length > limit;
        const chats = hasMore ? sortedChats.slice(0, limit) : sortedChats;

        resolve({ chats, hasMore });
      };

      request.onerror = () => reject(request.error);
    });
  }

  static async deleteChatById(id: string): Promise<void> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['chats', 'messages'], 'readwrite');
      const chatsStore = transaction.objectStore('chats');
      const messagesStore = transaction.objectStore('messages');
      const messagesIndex = messagesStore.index('by-chatId');

      // Delete chat
      chatsStore.delete(id);

      // Delete all messages in this chat
      const messagesRequest = messagesIndex.getAllKeys(id);
      messagesRequest.onsuccess = () => {
        const messageKeys = messagesRequest.result;
        messageKeys.forEach(key => messagesStore.delete(key));
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Message operations
  static async saveMessages(messages: DBMessage[]): Promise<void> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');

      let completed = 0;
      const total = messages.length;

      if (total === 0) {
        resolve();
        return;
      }

      messages.forEach(message => {
        const request = store.put(message);
        request.onsuccess = () => {
          completed++;
          if (completed === total) resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  static async getMessagesByChatId(chatId: string): Promise<DBMessage[]> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('by-chatId');
      const request = index.getAll(chatId);

      request.onsuccess = () => {
        const messages = request.result as DBMessage[];
        const sortedMessages = messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        resolve(sortedMessages);
      };

      request.onerror = () => reject(request.error);
    });
  }

  static async getMessageCountByUserId(
    userId: string,
    differenceInHours: number = 24
  ): Promise<number> {
    const db = await getDB();
    const cutoffTime = new Date(Date.now() - differenceInHours * 60 * 60 * 1000);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['chats', 'messages'], 'readonly');
      const chatsStore = transaction.objectStore('chats');
      const chatsIndex = chatsStore.index('by-userId');

      chatsIndex.getAll(userId).onsuccess = (event) => {
        const userChats = (event.target as IDBRequest).result as Chat[];
        const messagesStore = transaction.objectStore('messages');
        const messagesIndex = messagesStore.index('by-chatId');

        let totalCount = 0;
        let chatsProcessed = 0;

        if (userChats.length === 0) {
          resolve(0);
          return;
        }

        userChats.forEach(chat => {
          messagesIndex.getAll(chat.id).onsuccess = (event) => {
            const messages = (event.target as IDBRequest).result as DBMessage[];
            totalCount += messages.filter(
              msg => msg.role === 'user' && msg.createdAt >= cutoffTime
            ).length;

            chatsProcessed++;
            if (chatsProcessed === userChats.length) {
              resolve(totalCount);
            }
          };
        });
      };
    });
  }

  // Utility methods
  static async clear(): Promise<void> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['chats', 'messages'], 'readwrite');

      transaction.objectStore('chats').clear();
      transaction.objectStore('messages').clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  static async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      await getDB();
      return true;
    } catch {
      return false;
    }
  }
}